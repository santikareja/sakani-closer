import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AuthStoreIntegrityError,
  decodeSessionEncryptionKey,
  EncryptedFileAuthStore,
} from "./encrypted-store.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "sakani-wa-auth-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("EncryptedFileAuthStore", () => {
  it("round-trips Buffer values without leaving plaintext on disk", async () => {
    const directory = await temporaryDirectory();
    const store = new EncryptedFileAuthStore(directory, randomBytes(32));
    const marker = "plaintext-must-not-appear";

    await store.write("baileys:credentials", { marker, bytes: Buffer.from("signal-key") });
    const restored = await store.read<{ marker: string; bytes: Buffer }>("baileys:credentials");
    const [file] = await readdir(directory);
    const persisted = await readFile(path.join(directory, file!), "utf8");

    expect(restored?.marker).toBe(marker);
    expect(restored?.bytes.equals(Buffer.from("signal-key"))).toBe(true);
    expect(persisted).not.toContain(marker);
    expect(await store.list("baileys:")).toEqual(["baileys:credentials"]);
  });

  it("uses a unique IV for every write", async () => {
    const directory = await temporaryDirectory();
    const store = new EncryptedFileAuthStore(directory, randomBytes(32));
    await store.write("key", { value: 1 });
    const [file] = await readdir(directory);
    const first = JSON.parse(await readFile(path.join(directory, file!), "utf8")) as { iv: string };
    await store.write("key", { value: 1 });
    const second = JSON.parse(await readFile(path.join(directory, file!), "utf8")) as {
      iv: string;
    };

    expect(first.iv).not.toBe(second.iv);
  });

  it("rejects tampered ciphertext and a wrong encryption key", async () => {
    const directory = await temporaryDirectory();
    const store = new EncryptedFileAuthStore(directory, randomBytes(32));
    await store.write("key", { value: "sensitive" });
    const [file] = await readdir(directory);
    const filename = path.join(directory, file!);
    const envelope = JSON.parse(await readFile(filename, "utf8")) as { ciphertext: string };
    const firstCharacter = envelope.ciphertext.at(0);
    envelope.ciphertext = `${firstCharacter === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`;
    await writeFile(filename, JSON.stringify(envelope));

    await expect(store.read("key")).rejects.toBeInstanceOf(AuthStoreIntegrityError);

    const cleanDirectory = await temporaryDirectory();
    const firstKeyStore = new EncryptedFileAuthStore(cleanDirectory, randomBytes(32));
    await firstKeyStore.write("key", { value: "sensitive" });
    const wrongKeyStore = new EncryptedFileAuthStore(cleanDirectory, randomBytes(32));
    await expect(wrongKeyStore.read("key")).rejects.toBeInstanceOf(AuthStoreIntegrityError);
  });

  it("rejects malformed or short session encryption keys", () => {
    expect(() => decodeSessionEncryptionKey("short")).toThrow("SESSION_ENCRYPTION_KEY");
    expect(() => new EncryptedFileAuthStore("./wa-auth", Buffer.alloc(31))).toThrow(
      "exactly 32 bytes",
    );
  });
});
