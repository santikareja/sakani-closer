import { describe, expect, it } from "vitest";

import { whatsappStatusResponseSchema, type WhatsAppStatusResponse } from "./contracts";
import { createWhatsAppViewModel } from "./adapter";

function status(
  detail: NonNullable<WhatsAppStatusResponse["connection"]["detail"]>,
  binding: WhatsAppStatusResponse["binding"]["state"] = "bound",
): WhatsAppStatusResponse {
  const state =
    detail === "connected"
      ? "connected"
      : detail === "connecting" || detail === "qr_ready"
        ? "connecting"
        : detail === "transient_error"
          ? "unknown"
          : "disconnected";
  return {
    connection: {
      state,
      detail,
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
    binding: { state: binding },
    account: {
      status: state === "connected" ? "connected" : "disconnected",
      gatewayAccountId: "default",
      lastConnectedAt: state === "connected" ? "2026-10-02T00:00:00.000Z" : null,
      lastDisconnectedAt: null,
      phoneNumberMasked: state === "connected" ? "62812****789" : null,
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
    history: { capability: "limited" },
    diagnostics: { gateway: "healthy", lifecyclePersistence: "ok" },
  };
}

describe("WhatsApp presentation adapter", () => {
  it("rejects workspace and account authority in the public binding contract", () => {
    const payload = status("connected") as unknown as Record<string, unknown>;
    payload.binding = {
      state: "bound",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
    };

    expect(whatsappStatusResponseSchema.safeParse(payload).success).toBe(false);
  });

  it("normalizes connected and bound responses without inventing missing fields", () => {
    const view = createWhatsAppViewModel(status("connected"), "owner");
    expect(view.connectionState).toBe("connected");
    expect(view.bindingState).toBe("bound");
    expect(view.phoneNumberMasked).toBe("62812****789");
    expect(view.accountIdentifier).toBe("default");
    expect(view.lastConnectedAt).toBe("2026-10-02T00:00:00.000Z");
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
