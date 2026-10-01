import {
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";

import type { AuthStore } from "./store.js";

function accountPrefix(accountId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(accountId)) throw new TypeError("Invalid auth account id");
  return `baileys:account:${accountId}`;
}

export async function createBaileysAuthState(
  store: AuthStore,
  accountId = "default",
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const prefix = accountPrefix(accountId);
  const credentialsKey = `${prefix}:credentials`;
  const signalKey = (type: keyof SignalDataTypeMap, id: string) => `${prefix}:key:${type}:${id}`;
  const creds = (await store.read<AuthenticationCreds>(credentialsKey)) ?? initAuthCreds();

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
    saveCreds: () => store.write(credentialsKey, creds),
  };
}
