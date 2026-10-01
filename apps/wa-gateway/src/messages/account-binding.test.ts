import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { EncryptedFileAuthStore } from "../auth/encrypted-store.js";
import type { AuthStore } from "../auth/store.js";
import { AccountBindingStore } from "./account-binding.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

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

  it("encrypts the binding and restores it with the same key after restart", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sakani-binding-test-"));
    temporaryDirectories.push(directory);
    const key = randomBytes(32);
    const binding = {
      workspaceId: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
    };

    await new AccountBindingStore(new EncryptedFileAuthStore(directory, key)).set(binding);
    const files = await readdir(directory);
    const ciphertext = await readFile(path.join(directory, files[0]!), "utf8");
    const restarted = new AccountBindingStore(new EncryptedFileAuthStore(directory, key));

    expect(ciphertext).not.toContain(binding.workspaceId);
    expect(ciphertext).not.toContain(binding.accountId);
    await expect(restarted.load()).resolves.toEqual(binding);
  });
});
