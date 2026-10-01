import { describe, expect, it, vi } from "vitest";

import { consumeLoginAttempt, createLoginRateLimitKey } from "./rate-limit";

describe("login rate limiting", () => {
  it("uses a hashed key without exposing the email or IP", () => {
    const key = createLoginRateLimitKey("203.0.113.10", "owner@example.com");

    expect(key).not.toContain("owner@example.com");
    expect(key).not.toContain("203.0.113.10");
  });

  it("rejects attempts above the configured limit", async () => {
    const client = {
      isOpen: true,
      connect: vi.fn(),
      sendCommand: vi.fn().mockResolvedValue(6),
    };

    await expect(consumeLoginAttempt(client, "auth:login:test", 5, 900)).resolves.toBe(false);
  });
});
