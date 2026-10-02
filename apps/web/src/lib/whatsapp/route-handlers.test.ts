import { describe, expect, it, vi } from "vitest";

import type { WhatsAppGatewayClient } from "./gateway-client";
import type { GatewayStatusResponse } from "./gateway-internal-contracts";
import {
  createPublicWhatsAppStatus,
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

const account = {
  id: "00000000-0000-4000-8000-000000000013",
  gatewayAccountId: "default",
  status: "disconnected",
  phoneNumberMasked: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
};

function gatewayStatus(
  state: GatewayStatusResponse["connection"]["state"],
  binding: GatewayStatusResponse["binding"],
): GatewayStatusResponse {
  return {
    connection: {
      ...connection,
      state,
      reason: state === "connecting" ? "connect_requested" : connection.reason,
    },
    binding,
    lifecyclePersistence: { state: "unknown" },
    history: { capability: "limited" },
  };
}

function createDependencies(authenticated = true) {
  const gateway: WhatsAppGatewayClient = {
    getStatus: vi.fn(async (): Promise<GatewayStatusResponse> =>
      gatewayStatus("disconnected", { state: "unbound" }),
    ),
    connect: vi.fn(async (): Promise<GatewayStatusResponse> =>
      gatewayStatus("connecting", {
        state: "bound",
        workspaceId: session.workspaceId,
        accountId: account.id,
      }),
    ),
    disconnect: vi.fn(async (): Promise<GatewayStatusResponse> =>
      gatewayStatus("disconnected", {
        state: "bound",
        workspaceId: session.workspaceId,
        accountId: account.id,
      }),
    ),
    getQr: vi.fn(async () => ({ qr: "ephemeral-secret", expiresAt: "2026-10-01T00:01:00.000Z" })),
  };
  const dependencies: WhatsAppRouteDependencies = {
    applicationUrl: "https://sakani.example",
    getSession: vi.fn(async () => (authenticated ? session : null)),
    gateway,
    accountRegistry: {
      ensureAccount: vi.fn(async () => ({ id: account.id })),
      getAccount: vi.fn(async () => account),
      markConnecting: vi.fn(async () => undefined),
      markDisconnected: vi.fn(async () => undefined),
    },
  };
  return { dependencies, gateway };
}

describe("WhatsApp web BFF authorization", () => {
  it("keeps runtime, binding, and durable account status independent", () => {
    const connected = gatewayStatus("connected", {
      state: "bound",
      workspaceId: session.workspaceId,
      accountId: account.id,
    });
    const durableDisconnected = createPublicWhatsAppStatus(connected, account, session.workspaceId);
    const durableConnected = createPublicWhatsAppStatus(
      connected,
      {
        ...account,
        status: "connected",
        lastConnectedAt: new Date("2026-10-02T00:00:00.000Z"),
      },
      session.workspaceId,
    );
    const unbound = createPublicWhatsAppStatus(
      gatewayStatus("connected", { state: "unbound" }),
      account,
      session.workspaceId,
    );

    expect(durableDisconnected).toMatchObject({
      connection: { state: "connected" },
      binding: { state: "bound" },
      account: { status: "disconnected" },
    });
    expect(durableConnected.account.status).toBe("connected");
    expect(unbound).toMatchObject({
      connection: { state: "connected" },
      binding: { state: "unbound" },
    });
  });

  it("returns only public binding state without workspace or account authority", async () => {
    const { dependencies, gateway } = createDependencies();
    vi.mocked(gateway.getStatus).mockResolvedValueOnce(
      gatewayStatus("connected", {
        state: "bound",
        workspaceId: session.workspaceId,
        accountId: account.id,
      }),
    );

    const response = await handleWhatsAppStatus(
      new Request("https://sakani.example/api/v1/whatsapp/status"),
      dependencies,
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.binding).toEqual({ state: "bound" });
    expect(serialized).not.toContain(session.workspaceId);
    expect(serialized).not.toContain(account.id);
    expect(serialized).not.toContain("workspaceId");
    expect(serialized).not.toContain("accountId");
  });

  it("returns an honest unknown runtime status when the gateway is unavailable", async () => {
    const { dependencies, gateway } = createDependencies();
    vi.mocked(gateway.getStatus).mockRejectedValueOnce(new Error("unavailable"));
    const response = await handleWhatsAppStatus(
      new Request("https://sakani.example/api/v1/whatsapp/status"),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      connection: { state: "unknown" },
      binding: { state: "unknown" },
      account: { status: "disconnected" },
      diagnostics: { gateway: "unavailable" },
    });
  });

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

  it("rejects a gateway binding owned by another workspace", async () => {
    const { dependencies, gateway } = createDependencies();
    vi.mocked(gateway.getStatus).mockResolvedValueOnce(
      gatewayStatus("connected", {
        state: "bound",
        workspaceId: "00000000-0000-4000-8000-000000000099",
        accountId: "00000000-0000-4000-8000-000000000098",
      }),
    );
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(409);
    expect(dependencies.accountRegistry.ensureAccount).not.toHaveBeenCalled();
    expect(gateway.connect).not.toHaveBeenCalled();
  });

  it("returns the durable account to disconnected when gateway connect fails", async () => {
    const { dependencies, gateway } = createDependencies();
    vi.mocked(gateway.connect).mockRejectedValueOnce(new Error("unavailable"));
    const response = await handleWhatsAppMutation(
      new Request("https://sakani.example/api/v1/whatsapp/connect", {
        method: "POST",
        headers: { origin: "https://sakani.example", "content-type": "application/json" },
        body: "{}",
      }),
      dependencies,
      "connect",
    );

    expect(response.status).toBe(503);
    expect(dependencies.accountRegistry.markConnecting).toHaveBeenCalledOnce();
    expect(dependencies.accountRegistry.markDisconnected).toHaveBeenCalledOnce();
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
