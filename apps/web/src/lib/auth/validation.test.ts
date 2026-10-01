import { describe, expect, it } from "vitest";

import { loginSchema, PASSWORD_MAX_LENGTH, registrationSchema } from "./validation";

describe("authentication input validation", () => {
  it("rejects malformed login input", () => {
    expect(loginSchema.safeParse({ email: "bukan-email", password: "pendek" }).success).toBe(false);
  });

  it("limits password length to prevent excessive hashing work", () => {
    expect(
      loginSchema.safeParse({
        email: "owner@example.com",
        password: "x".repeat(PASSWORD_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("normalizes email while validating registration fields", () => {
    const result = registrationSchema.parse({
      displayName: "Owner Sakani",
      workspaceName: "Sakani Barat",
      email: " OWNER@EXAMPLE.COM ",
      password: "kata-sandi-aman-123",
    });

    expect(result.email).toBe("owner@example.com");
  });
});
