import { describe, expect, it } from "vitest";

import type { GatewayStatusResponse } from "./contracts";
import { createWhatsAppViewModel } from "./adapter";

function status(
  state: GatewayStatusResponse["connection"]["state"],
  binding: GatewayStatusResponse["binding"]["state"] = "bound",
): GatewayStatusResponse {
  return {
    connection: {
      state,
      reason: state === "connected" ? "connection_opened" : "service_started",
      updatedAt: "2026-10-02T00:00:00.000Z",
      ...(state === "connected" ? { phoneNumberMasked: "62812****789" } : {}),
    },
    binding: { state: binding },
  };
}

describe("WhatsApp presentation adapter", () => {
  it("normalizes connected and bound responses without inventing missing fields", () => {
    const view = createWhatsAppViewModel(status("connected"), "owner");
    expect(view.connectionState).toBe("connected");
    expect(view.bindingState).toBe("bound");
    expect(view.phoneNumberMasked).toBe("62812****789");
    expect(view.accountIdentifier).toBeNull();
    expect(view.lastConnectedAt).toBeNull();
    expect(view.capabilities.disconnect.available).toBe(true);
  });

  it("normalizes unbound, unavailable, and role-restricted states", () => {
    const unbound = createWhatsAppViewModel(status("disconnected", "unbound"), "viewer");
    expect(unbound.connectionState).toBe("disconnected");
    expect(unbound.bindingLabel).toBe("Belum terikat");
    expect(unbound.capabilities.connect.available).toBe(false);

    const unavailable = createWhatsAppViewModel(null, "owner");
    expect(unavailable.connectionState).toBe("unknown");
    expect(unavailable.gatewayHealth).toBe("unavailable");
  });

  it("treats qr_ready as an explicit connecting state", () => {
    const view = createWhatsAppViewModel(status("qr_ready"), "owner");
    expect(view.connectionState).toBe("connecting");
    expect(view.isQrExpected).toBe(true);
  });
});
