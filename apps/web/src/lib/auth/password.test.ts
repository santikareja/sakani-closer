import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("stores an Argon2id hash instead of plaintext", async () => {
    const password = "kata-sandi-aman-123";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
  });

  it("verifies the correct password", async () => {
    const passwordHash = await hashPassword("kata-sandi-benar-123");

    await expect(verifyPassword(passwordHash, "kata-sandi-benar-123")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("kata-sandi-benar-123");

    await expect(verifyPassword(passwordHash, "kata-sandi-salah-456")).resolves.toBe(false);
  });
});
