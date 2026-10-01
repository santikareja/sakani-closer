import { describe, expect, it } from "vitest";

import {
  generateSessionToken,
  hashSessionToken,
  openSessionCookie,
  sealSessionCookie,
} from "./session-crypto";

const secret = "test-auth-secret-at-least-32-characters-long";
const payload = {
  version: 1 as const,
  workspaceId: "00000000-0000-4000-8000-000000000001",
  token: "a".repeat(43),
  expiresAt: Date.parse("2026-10-08T00:00:00.000Z"),
};

describe("session cookie cryptography", () => {
  it("generates independent 256-bit opaque tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toHaveLength(43);
    expect(second).toHaveLength(43);
    expect(first).not.toBe(second);
    expect(hashSessionToken(first)).toHaveLength(64);
  });

  it("encrypts and authenticates workspace session context", () => {
    const cookie = sealSessionCookie(payload, secret);

    expect(cookie).not.toContain(payload.token);
    expect(cookie).not.toContain(payload.workspaceId);
    expect(cookie).not.toContain(secret);
    expect(openSessionCookie(cookie, secret)).toEqual(payload);
  });

  it("rejects a tampered cookie", () => {
    const cookie = sealSessionCookie(payload, secret);
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;

    expect(openSessionCookie(tampered, secret)).toBeNull();
  });
});
