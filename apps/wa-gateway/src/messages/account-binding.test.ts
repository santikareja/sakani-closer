import { describe, expect, it, vi } from "vitest";

import type { AuthStore } from "../auth/store.js";
import { AccountBindingStore } from "./account-binding.js";

function memoryStore(): AuthStore {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    write: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    list: vi.fn(async (prefix = "") => [...values.keys()].filter((key) => key.startsWith(prefix))),
    flush: vi.fn(async () => undefined),
  };
}

describe("persistent gateway account binding", () => {
  it("restores the workspace/account route after a process restart", async () => {
    const store = memoryStore();
    const binding = {
      workspaceId: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
    };
    await new AccountBindingStore(store).set(binding);

    const restarted = new AccountBindingStore(store);
    await expect(restarted.load()).resolves.toEqual(binding);
    expect(restarted.get()).toEqual(binding);
    expect(store.flush).toHaveBeenCalledOnce();
  });

  it("rejects a malformed binding instead of routing across workspaces", async () => {
    const store = memoryStore();
    await store.write("gateway:account-binding", {
      workspaceId: "not-a-workspace",
      accountId: "not-an-account",
    });
    await expect(new AccountBindingStore(store).load()).rejects.toThrow();
  });
});
