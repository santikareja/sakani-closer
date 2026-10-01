import { describe, expect, it } from "vitest";

import { getSafeRedirectPath, isSameOriginMutation } from "./http";

describe("authentication HTTP safeguards", () => {
  it("allows only same-origin mutations", () => {
    const sameOrigin = new Request("https://app.example.com/api/auth/login", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    });
    const crossOrigin = new Request("https://app.example.com/api/auth/login", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(isSameOriginMutation(sameOrigin, "https://app.example.com")).toBe(true);
    expect(isSameOriginMutation(crossOrigin, "https://app.example.com")).toBe(false);
  });

  it("prevents open redirects", () => {
    expect(getSafeRedirectPath("/dashboard?tab=owner")).toBe("/dashboard?tab=owner");
    expect(getSafeRedirectPath("https://attacker.example/phish")).toBe("/dashboard");
    expect(getSafeRedirectPath("//attacker.example/phish")).toBe("/dashboard");
  });
});
