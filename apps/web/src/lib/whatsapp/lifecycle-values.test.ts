import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lifecycleUpdateValues } from "./inbound-repository";

describe("durable WhatsApp lifecycle values", () => {
  const now = new Date("2026-10-02T00:00:00.000Z");

  it("sets connected fields without overwriting last disconnected time", () => {
    const values = lifecycleUpdateValues(
      { state: "connected", phoneNumberMasked: "62812****789" },
      now,
    );

    expect(values).toMatchObject({
      status: "connected",
      lastConnectedAt: now,
      updatedAt: now,
      accountIdentifierMasked: "62812****789",
    });
    expect(values).not.toHaveProperty("lastDisconnectedAt");
  });

  it("sets disconnected fields without overwriting last connected time", () => {
    const values = lifecycleUpdateValues({ state: "disconnected" }, now);

    expect(values).toMatchObject({
      status: "disconnected",
      lastDisconnectedAt: now,
      updatedAt: now,
    });
    expect(values).not.toHaveProperty("lastConnectedAt");
    expect(values).not.toHaveProperty("accountIdentifierMasked");
  });
});
