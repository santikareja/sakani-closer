import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection/manager.js";
import { ConnectionStateMachine } from "../connection/state-machine.js";
import type {
  ConnectionCallbacks,
  GatewayConnector,
  GatewayLogger,
  GatewaySocket,
} from "../connection/types.js";
import { QrManager } from "../qr/qr-manager.js";
import { closeServer, createGatewayServer, listen } from "../server.js";

const token = "internal-test-token-with-at-least-32-characters";

class TestConnector implements GatewayConnector {
  callbacks: ConnectionCallbacks | undefined;

  async open(callbacks: ConnectionCallbacks): Promise<GatewaySocket> {
    this.callbacks = callbacks;
    return { close: vi.fn(async () => undefined) };
  }
}

function testLogger(): GatewayLogger {
  const noop = () => undefined;
  return { debug: noop, info: noop, warn: noop, error: noop };
}

describe("WhatsApp gateway internal routes", () => {
  let now: number;
  let qrManager: QrManager;
  let manager: ConnectionManager;
  let server: ReturnType<typeof createGatewayServer>;
  let baseUrl: string;

  beforeEach(async () => {
    now = Date.parse("2026-10-01T00:00:00.000Z");
    qrManager = new QrManager(1_000, () => now);
    manager = new ConnectionManager(
      new TestConnector(),
      new ConnectionStateMachine(),
      qrManager,
      testLogger(),
    );
    server = createGatewayServer({
      manager,
      qrManager,
      internalServiceToken: token,
      logger: testLogger(),
      bindAccount: async () => undefined,
    });
    await listen(server, 0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await manager.disconnect();
    await closeServer(server);
  });

  it("keeps health public on the internal network and safe while disconnected", async () => {
    qrManager.publish("must-not-leak");
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    expect(JSON.stringify(body)).not.toContain(token);
    expect(body.connection).toMatchObject({ state: "disconnected" });
  });

  it("rejects missing and incorrect internal service tokens", async () => {
    const missing = await fetch(`${baseUrl}/internal/status`);
    const incorrect = await fetch(`${baseUrl}/internal/status`, {
      headers: { authorization: "Bearer wrong-token" },
    });

    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
  });

  it("accepts the correct token without returning auth state", async () => {
    const response = await fetch(`${baseUrl}/internal/status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).toContain("disconnected");
    expect(serialized).not.toContain("credentials");
    expect(serialized).not.toContain(token);
  });

  it("returns only an unexpired QR to an authenticated caller", async () => {
    qrManager.publish("ephemeral-qr");
    const available = await fetch(`${baseUrl}/internal/qr`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(available.status).toBe(200);
    expect(await available.json()).toMatchObject({ qr: "ephemeral-qr" });

    now += 1_001;
    const expired = await fetch(`${baseUrl}/internal/qr`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(expired.status).toBe(404);
    expect(JSON.stringify(await expired.json())).not.toContain("ephemeral-qr");
  });

  it("rate-limits connect requests", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await fetch(`${baseUrl}/internal/connect`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: "00000000-0000-4000-8000-000000000001",
          accountId: "00000000-0000-4000-8000-000000000002",
        }),
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });

  it("returns sanitized validation errors without echoing submitted secrets", async () => {
    const submittedSecret = "do-not-echo-this-secret";
    const response = await fetch(`${baseUrl}/internal/connect`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: submittedSecret,
    });
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(serialized).not.toContain(submittedSecret);
    expect(serialized).not.toContain(token);
  });
});
