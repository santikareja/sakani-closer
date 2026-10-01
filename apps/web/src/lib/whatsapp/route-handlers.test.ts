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

const session = {
  sessionId: "00000000-0000-4000-8000-000000000010",
  userId: "00000000-0000-4000-8000-000000000011",
  email: "owner@example.com",
  displayName: "Owner",
  workspaceId: "00000000-0000-4000-8000-000000000012",
  workspaceName: "Sakani",
  role: "owner",
  expiresAt: new Date("2026-10-08T00:00:00.000Z"),
};

function createDependencies(authenticated = true) {
  const gateway: WhatsAppGatewayClient = {
    getStatus: vi.fn(async (): Promise<GatewayStatusResponse> => ({
      connection,
      binding: { state: "unbound" },
    })),
    connect: vi.fn(async (): Promise<GatewayStatusResponse> => ({
      connection: { ...connection, state: "connecting", reason: "connect_requested" },
      binding: { state: "bound" },
    })),
    disconnect: vi.fn(async (): Promise<GatewayStatusResponse> => ({
      connection: { ...connection, reason: "explicit_disconnect" },
      binding: { state: "bound" },
    })),
    getQr: vi.fn(async () => ({ qr: "ephemeral-secret", expiresAt: "2026-10-01T00:01:00.000Z" })),
  };
  const dependencies: WhatsAppRouteDependencies = {
    applicationUrl: "https://sakani.example",
    getSession: vi.fn(async () => (authenticated ? session : null)),
    gateway,
    accountRegistry: {
      ensureAccount: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000013",
      })),
    },
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
    expect(dependencies.accountRegistry.ensureAccount).toHaveBeenCalledWith({
      workspaceId: session.workspaceId,
    });
    expect(gateway.connect).toHaveBeenCalledWith({
      workspaceId: session.workspaceId,
      accountId: "00000000-0000-4000-8000-000000000013",
    });
    expect(
      vi.mocked(dependencies.accountRegistry.ensureAccount).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(gateway.connect).mock.invocationCallOrder[0]!);
    expect(JSON.stringify(await response.json())).not.toContain("INTERNAL_SERVICE_TOKEN");
  });

  it("rejects client-supplied workspace authority", async () => {
    const { dependencies, gateway } = createDependencies();
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "00000000-0000-4000-8000-000000000099" }),
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(400);
    expect(dependencies.accountRegistry.ensureAccount).not.toHaveBeenCalled();
    expect(gateway.connect).not.toHaveBeenCalled();
  });

  it("requires the owner role for WhatsApp control", async () => {
    const { dependencies, gateway } = createDependencies();
    dependencies.getSession = vi.fn(async () => ({ ...session, role: "viewer" }));
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(403);
    expect(dependencies.accountRegistry.ensureAccount).not.toHaveBeenCalled();
    expect(gateway.connect).not.toHaveBeenCalled();
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
