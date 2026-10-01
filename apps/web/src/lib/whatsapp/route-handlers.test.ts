import { describe, expect, it, vi } from "vitest";

import type { WhatsAppGatewayClient } from "./gateway-client";
import type { GatewayStatusResponse } from "./contracts";
import {
  handleWhatsAppMutation,
  handleWhatsAppQr,
  handleWhatsAppStatus,
  type WhatsAppRouteDependencies,
} from "./route-handlers";

const connection = {
  state: "disconnected" as const,
  reason: "service_started" as const,
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function createDependencies(authenticated = true) {
  const gateway: WhatsAppGatewayClient = {
    getStatus: vi.fn(async (): Promise<GatewayStatusResponse> => ({ connection })),
    connect: vi.fn(async (): Promise<GatewayStatusResponse> => ({
      connection: { ...connection, state: "connecting", reason: "connect_requested" },
    })),
    disconnect: vi.fn(async (): Promise<GatewayStatusResponse> => ({
      connection: { ...connection, reason: "disconnect_requested" },
    })),
    getQr: vi.fn(async () => ({ qr: "ephemeral-secret", expiresAt: "2026-10-01T00:01:00.000Z" })),
  };
  const dependencies: WhatsAppRouteDependencies = {
    applicationUrl: "https://sakani.example",
    getSession: vi.fn(async () => (authenticated ? { userId: "owner" } : null)),
    gateway,
  };
  return { dependencies, gateway };
}

describe("WhatsApp web BFF authorization", () => {
  it("rejects unauthenticated status and QR requests before calling the gateway", async () => {
    const { dependencies, gateway } = createDependencies(false);

    const status = await handleWhatsAppStatus(
      new Request("https://sakani.example/api/v1/whatsapp/status"),
      dependencies,
    );
    const qr = await handleWhatsAppQr(
      new Request("https://sakani.example/api/v1/whatsapp/qr"),
      dependencies,
    );

    expect(status.status).toBe(401);
    expect(qr.status).toBe(401);
    expect(gateway.getStatus).not.toHaveBeenCalled();
    expect(gateway.getQr).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before gateway access", async () => {
    const { dependencies, gateway } = createDependencies();
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://attacker.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(403);
    expect(gateway.connect).not.toHaveBeenCalled();
  });

  it("allows an authenticated same-origin owner to connect", async () => {
    const { dependencies, gateway } = createDependencies();
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(202);
    expect(gateway.connect).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain("INTERNAL_SERVICE_TOKEN");
  });

  it("refreshes QR by closing the active socket before reconnecting", async () => {
    const { dependencies, gateway } = createDependencies();
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/refresh", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "refresh",
    );

    expect(response.status).toBe(202);
    expect(gateway.disconnect).toHaveBeenCalledOnce();
    expect(gateway.connect).toHaveBeenCalledOnce();
    expect(vi.mocked(gateway.disconnect).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gateway.connect).mock.invocationCallOrder[0]!,
    );
  });
});
