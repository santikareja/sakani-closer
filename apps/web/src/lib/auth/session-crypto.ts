import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { z } from "zod";

const COOKIE_VERSION = "v1";
const COOKIE_AAD = Buffer.from("sakani-closer-session-v1", "utf8");

const sessionCookiePayloadSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().uuid(),
  token: z.string().length(43),
  expiresAt: z.number().int().positive(),
});

export type SessionCookiePayload = z.infer<typeof sessionCookiePayloadSchema>;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function sealSessionCookie(payload: SessionCookiePayload, secret: string): string {
  const validated = sessionCookiePayloadSchema.parse(payload);
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), initializationVector);
  cipher.setAAD(COOKIE_AAD);

  const plaintext = Buffer.from(JSON.stringify(validated), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    COOKIE_VERSION,
    initializationVector.toString("base64url"),
    ciphertext.toString("base64url"),
    authenticationTag.toString("base64url"),
  ].join(".");
}

export function openSessionCookie(value: string, secret: string): SessionCookiePayload | null {
  try {
    const [version, initializationVector, ciphertext, authenticationTag, extra] = value.split(".");
    if (
      version !== COOKIE_VERSION ||
      !initializationVector ||
      !ciphertext ||
      !authenticationTag ||
      extra
    ) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(initializationVector, "base64url"),
    );
    decipher.setAAD(COOKIE_AAD);
    decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return sessionCookiePayloadSchema.parse(JSON.parse(plaintext));
  } catch {
    return null;
  }
}
