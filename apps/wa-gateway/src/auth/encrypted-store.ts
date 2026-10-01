import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { BufferJSON } from "@whiskeysockets/baileys";
import { z } from "zod";

import type { AuthStore } from "./store.js";

const logicalKeySchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => !value.includes("\0"), {
    message: "Auth store key contains an invalid character",
  });

const envelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("aes-256-gcm"),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
});

const payloadSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export class AuthStoreIntegrityError extends Error {
  constructor() {
    super("Encrypted WhatsApp auth state failed integrity validation");
    this.name = "AuthStoreIntegrityError";
  }
}

export function decodeSessionEncryptionKey(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("SESSION_ENCRYPTION_KEY must be a 32-byte base64url value without padding");
  }

  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) {
    throw new TypeError("SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class EncryptedFileAuthStore implements AuthStore {
  private readonly encryptionKey: Buffer;
  private readonly keyLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly directory: string,
    encryptionKey: string | Buffer,
  ) {
    if (directory.trim().length === 0) {
      throw new TypeError("Auth data directory cannot be empty");
    }
    this.encryptionKey =
      typeof encryptionKey === "string"
        ? decodeSessionEncryptionKey(encryptionKey)
        : Buffer.from(encryptionKey);
    if (this.encryptionKey.length !== 32) {
      throw new TypeError("Auth store encryption key must contain exactly 32 bytes");
    }
  }

  async read<T>(key: string): Promise<T | undefined> {
    const safeKey = logicalKeySchema.parse(key);
    return this.withKeyLock(safeKey, async () => {
      try {
        const serialized = await readFile(this.filePath(safeKey), "utf8");
        const payload = this.decrypt(serialized);
        if (payload.key !== safeKey) throw new AuthStoreIntegrityError();
        return payload.value as T;
      } catch (error) {
        if (isNodeError(error, "ENOENT")) return undefined;
        if (error instanceof AuthStoreIntegrityError) throw error;
        throw new AuthStoreIntegrityError();
      }
    });
  }

  async write<T>(key: string, value: T): Promise<void> {
    const safeKey = logicalKeySchema.parse(key);
    const serialized = JSON.stringify({ key: safeKey, value }, BufferJSON.replacer);
    await this.withKeyLock(safeKey, async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });

      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
      const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
      const envelope = JSON.stringify({
        version: 1,
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
      });

      const destination = this.filePath(safeKey);
      const temporary = path.join(this.directory, `.${randomUUID()}.tmp`);
      await writeFile(temporary, envelope, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporary, destination);
    });
  }

  async delete(key: string): Promise<void> {
    const safeKey = logicalKeySchema.parse(key);
    await this.withKeyLock(safeKey, async () => {
      try {
        await unlink(this.filePath(safeKey));
      } catch (error) {
        if (!isNodeError(error, "ENOENT")) throw error;
      }
    });
  }

  async list(prefix = ""): Promise<string[]> {
    logicalKeySchema.or(z.literal("")).parse(prefix);
    let files: string[];
    try {
      files = await readdir(this.directory);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return [];
      throw error;
    }

    const keys: string[] = [];
    for (const file of files.filter((name) => name.endsWith(".auth"))) {
      try {
        const payload = this.decrypt(await readFile(path.join(this.directory, file), "utf8"));
        if (payload.key.startsWith(prefix)) keys.push(payload.key);
      } catch {
        throw new AuthStoreIntegrityError();
      }
    }
    return keys.sort();
  }

  private filePath(key: string): string {
    const digest = createHash("sha256").update(key).digest("hex");
    return path.join(this.directory, `${digest}.auth`);
  }

  private async withKeyLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.keyLocks.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const completion = result.then(
      () => undefined,
      () => undefined,
    );
    this.keyLocks.set(key, completion);
    try {
      return await result;
    } finally {
      if (this.keyLocks.get(key) === completion) this.keyLocks.delete(key);
    }
  }

  private decrypt(serialized: string): z.infer<typeof payloadSchema> {
    try {
      const envelope = envelopeSchema.parse(JSON.parse(serialized));
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(envelope.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      return payloadSchema.parse(JSON.parse(plaintext, BufferJSON.reviver));
    } catch {
      throw new AuthStoreIntegrityError();
    }
  }
}
