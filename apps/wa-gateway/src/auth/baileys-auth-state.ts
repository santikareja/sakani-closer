import {
  initAuthCreds,
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

const registeredCredentialsSchema = z.object({
  registered: z.literal(true),
});

export async function hasRegisteredBaileysSession(
  store: AuthStore,
  accountId = "default",
): Promise<boolean> {
  const credentials = await store.read<unknown>(credentialsKey(accountId));
  return registeredCredentialsSchema.safeParse(credentials).success;
}

const connectionIntentSchema = z.object({
  autoReconnect: z.boolean(),
});

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
): Promise<void> {
  await store.write(connectionIntentKey(accountId), { autoReconnect });
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
  const creds = (await store.read<AuthenticationCreds>(accountCredentialsKey)) ?? initAuthCreds();

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
  await Promise.all(keys.map((key) => store.delete(key)));
}
