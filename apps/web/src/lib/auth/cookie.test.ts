import { describe, expect, it } from "vitest";

import {
  getExpiredSessionCookieOptions,
  getSessionCookieOptions,
  shouldUseSecureCookie,
} from "./cookie";

describe("session cookie options", () => {
  it("sets all required security attributes", () => {
    const expiresAt = new Date("2026-10-08T00:00:00.000Z");

    expect(getSessionCookieOptions(expiresAt, true)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      expires: expiresAt,
    });
    expect(getSessionCookieOptions(expiresAt, false).secure).toBe(false);
  });

  it("expires the browser cookie on logout", () => {
    expect(getExpiredSessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      maxAge: 0,
      path: "/",
    });
  });

  it("uses Secure in production and whenever the application URL uses HTTPS", () => {
    expect(shouldUseSecureCookie("production", "http://localhost:3000")).toBe(true);
    expect(shouldUseSecureCookie("development", "https://app.example.com")).toBe(true);
    expect(shouldUseSecureCookie("development", "http://localhost:3000")).toBe(false);
  });
});
