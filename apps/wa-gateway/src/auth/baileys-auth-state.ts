import {
  initAuthCreds,
  jidDecode,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { z } from "zod";

import type { AuthStore } from "./store.js";

function accountPrefix(accountId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(accountId)) throw new TypeError("Invalid auth account id");
  return `baileys:account:${accountId}`;
}

function credentialsKey(accountId: string): string {
  return `${accountPrefix(accountId)}:credentials`;
}

function connectionIntentKey(accountId: string): string {
  return `${accountPrefix(accountId)}:connection-intent`;
}

const nonEmptyBytesSchema = z.custom<Uint8Array>(
  (value) => value instanceof Uint8Array && value.byteLength > 0,
);

const keyPairSchema = z.object({
  public: nonEmptyBytesSchema,
  private: nonEmptyBytesSchema,
});

const authenticationCredentialsSchema = z.object({
  noiseKey: keyPairSchema,
  pairingEphemeralKeyPair: keyPairSchema.optional(),
  signedIdentityKey: keyPairSchema,
  signedPreKey: z.object({
    keyPair: keyPairSchema,
    signature: nonEmptyBytesSchema,
    keyId: z.number().int().nonnegative(),
  }),
  registrationId: z.number().int().nonnegative(),
  advSecretKey: z.string().min(1),
  registered: z.boolean().optional(),
  me: z.object({ id: z.string().min(1) }).optional(),
});

export const authStateClassifications = [
  "missing",
  "corrupt",
  "unregistered",
  "registered",
  "logged_out",
] as const;

export type AuthStateClassification = (typeof authStateClassifications)[number];

export const reconnectPolicyReasons = [
  "active",
  "explicit_disconnect",
  "explicit_reset",
  "logged_out",
  "invalid_auth",
] as const;

export type ReconnectPolicyReason = (typeof reconnectPolicyReasons)[number];

export interface BaileysAuthStateInspection {
  classification: AuthStateClassification;
  hasCreds: boolean;
  hasMe: boolean;
  registeredFlag: boolean;
  hasKeys: boolean;
  autoReconnect: boolean;
  reason:
    | ReconnectPolicyReason
    | "missing_auth_state"
    | "corrupt_auth_state"
    | "unregistered_auth_state"
    | "registered_auth_state"
    | "legacy_disabled";
}

export function classifyBaileysAuthState(
  credentials: unknown,
  hasKeys: boolean,
): Omit<BaileysAuthStateInspection, "autoReconnect" | "reason"> {
  if (credentials === undefined) {
    return {
      classification: "missing",
      hasCreds: false,
      hasMe: false,
      registeredFlag: false,
      hasKeys,
    };
  }

  const parsed = authenticationCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return {
      classification: "corrupt",
      hasCreds: true,
      hasMe: false,
      registeredFlag: false,
      hasKeys,
    };
  }

  const decodedMe = parsed.data.me ? jidDecode(parsed.data.me.id) : undefined;
  const hasMe = Boolean(decodedMe?.user && decodedMe.server);
  return {
    classification: hasMe ? "registered" : "unregistered",
    hasCreds: true,
    hasMe,
    registeredFlag: parsed.data.registered ?? false,
    hasKeys,
  };
}

export async function hasRegisteredBaileysSession(
  store: AuthStore,
  accountId = "default",
): Promise<boolean> {
  return (await inspectBaileysAuthState(store, accountId)).classification === "registered";
}

const connectionIntentSchema = z.object({
  autoReconnect: z.boolean(),
  reason: z.enum(reconnectPolicyReasons).optional(),
});

export async function inspectBaileysAuthState(
  store: AuthStore,
  accountId = "default",
): Promise<BaileysAuthStateInspection> {
  let credentials: unknown;
  let storedIntent: unknown;
  let hasKeys: boolean;
  try {
    [credentials, storedIntent, hasKeys] = await Promise.all([
      store.read<unknown>(credentialsKey(accountId)),
      store.read<unknown>(connectionIntentKey(accountId)),
      store.list(`${accountPrefix(accountId)}:key:`).then((keys) => keys.length > 0),
    ]);
  } catch {
    return {
      classification: "corrupt",
      hasCreds: false,
      hasMe: false,
      registeredFlag: false,
      hasKeys: false,
      autoReconnect: false,
      reason: "corrupt_auth_state",
    };
  }

  const parsedIntent = connectionIntentSchema.safeParse(storedIntent);
  if (storedIntent !== undefined && !parsedIntent.success) {
    return {
      ...classifyBaileysAuthState(credentials, hasKeys),
      classification: "corrupt",
      autoReconnect: false,
      reason: "corrupt_auth_state",
    };
  }

  const intent = parsedIntent.success ? parsedIntent.data : undefined;
  const diagnostics = classifyBaileysAuthState(credentials, hasKeys);
  const rejectedByWhatsApp = intent?.reason === "logged_out" || intent?.reason === "invalid_auth";
  const classification: AuthStateClassification = rejectedByWhatsApp
    ? "logged_out"
    : diagnostics.classification;
  const autoReconnect = classification === "registered" && intent?.autoReconnect !== false;
  const defaultReason =
    classification === "missing"
      ? "missing_auth_state"
      : classification === "corrupt"
        ? "corrupt_auth_state"
        : classification === "unregistered"
          ? "unregistered_auth_state"
          : classification === "logged_out"
            ? "logged_out"
            : "registered_auth_state";
  const reason =
    classification === "corrupt"
      ? "corrupt_auth_state"
      : classification === "registered"
        ? (intent?.reason ??
          (intent?.autoReconnect === false ? "legacy_disabled" : "registered_auth_state"))
        : intent?.reason === "explicit_reset" || intent?.reason === "logged_out"
          ? intent.reason
          : defaultReason;
  return {
    ...diagnostics,
    classification,
    autoReconnect,
    reason,
  };
}

export async function readBaileysAutoReconnectIntent(
  store: AuthStore,
  accountId = "default",
): Promise<boolean | undefined> {
  const stored = await store.read<unknown>(connectionIntentKey(accountId));
  if (stored === undefined) return undefined;
  return connectionIntentSchema.parse(stored).autoReconnect;
}

export async function writeBaileysAutoReconnectIntent(
  store: AuthStore,
  autoReconnect: boolean,
  accountId = "default",
  reason: ReconnectPolicyReason = autoReconnect ? "active" : "explicit_disconnect",
): Promise<void> {
  await store.write(connectionIntentKey(accountId), { autoReconnect, reason });
}

export async function createBaileysAuthState(
  store: AuthStore,
  accountId = "default",
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const prefix = accountPrefix(accountId);
  const accountCredentialsKey = credentialsKey(accountId);
  const signalKey = (type: keyof SignalDataTypeMap, id: string) => `${prefix}:key:${type}:${id}`;
  const storedCredentials = await store.read<unknown>(accountCredentialsKey);
  const hasKeys = (await store.list(`${prefix}:key:`)).length > 0;
  const classification = classifyBaileysAuthState(storedCredentials, hasKeys);
  if (classification.classification === "corrupt") {
    throw new TypeError("Stored WhatsApp authentication state is invalid");
  }
  const creds =
    storedCredentials === undefined ? initAuthCreds() : (storedCredentials as AuthenticationCreds);

  const state: AuthenticationState = {
    creds,
    keys: {
      async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await store.read<SignalDataTypeMap[T]>(signalKey(type, id));
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as proto.Message.IAppStateSyncKeyData,
              ) as unknown as SignalDataTypeMap[T];
            }
            if (value) result[id] = value;
          }),
        );
        return result;
      },
      async set(data: SignalDataSet) {
        const operations: Promise<void>[] = [];
        for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          const entries = data[type];
          if (!entries) continue;
          for (const [id, value] of Object.entries(entries)) {
            operations.push(
              value === null
                ? store.delete(signalKey(type, id))
                : store.write(signalKey(type, id), value),
            );
          }
        }
        await Promise.all(operations);
      },
    },
  };

  return {
    state,
    saveCreds: () => store.write(accountCredentialsKey, creds),
  };
}

export async function clearBaileysAuthState(
  store: AuthStore,
  accountId = "default",
): Promise<void> {
  const prefix = accountPrefix(accountId);
  const keys = await store.list(`${prefix}:`);
  const intentKey = connectionIntentKey(accountId);
  await Promise.all(keys.filter((key) => key !== intentKey).map((key) => store.delete(key)));
}
