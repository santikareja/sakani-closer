import { describe, expect, it, vi } from "vitest";

import { ConnectionManager, computeReconnectDelay } from "./manager.js";
import { ConnectionStateMachine } from "./state-machine.js";
import type {
  ConnectionCallbacks,
  GatewayConnector,
  GatewayLogger,
  GatewaySocket,
} from "./types.js";
import { QrManager } from "../qr/qr-manager.js";

function createLogger() {
  const output: string[] = [];
  const write = (bindings: Record<string, unknown>, message?: string) => {
    output.push(JSON.stringify({ bindings, message }));
  };
  const logger: GatewayLogger = { debug: write, info: write, warn: write, error: write };
  return { logger, output };
}

class FakeConnector implements GatewayConnector {
  callbacks: ConnectionCallbacks[] = [];
  openCount = 0;
  readonly socket: GatewaySocket = { close: vi.fn(async () => undefined) };

  async open(callbacks: ConnectionCallbacks): Promise<GatewaySocket> {
    this.openCount += 1;
    this.callbacks.push(callbacks);
    return this.socket;
  }
}

describe("ConnectionManager", () => {
  it("keeps QR data out of state and logger output", async () => {
    const connector = new FakeConnector();
    const { logger, output } = createLogger();
    const qrManager = new QrManager();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      qrManager,
      logger,
    );
    const secretQr = "secret-qr-payload";

    await manager.connect();
    connector.callbacks[0]!.onQr(secretQr);

    expect(manager.getStatus().state).toBe("qr_ready");
    expect(manager.getStatus()).not.toHaveProperty("qr");
    expect(qrManager.get()?.qr).toBe(secretQr);
    expect(output.join("\n")).not.toContain(secretQr);
    await manager.disconnect();
  });

  it("keeps repeated connect requests idempotent", async () => {
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await Promise.all([manager.connect(), manager.connect(), manager.connect()]);

    expect(connector.openCount).toBe(1);
    await manager.disconnect();
  });

  it("exposes only a masked phone number while connected", async () => {
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await manager.connect();
    connector.callbacks[0]!.onOpen("62812****789");

    expect(manager.getStatus()).toMatchObject({
      state: "connected",
      phoneNumberMasked: "62812****789",
    });
    expect(JSON.stringify(manager.getStatus())).not.toContain("628123456789");
    await manager.disconnect();
    expect(manager.getStatus()).not.toHaveProperty("phoneNumberMasked");
  });

  it("does not reconnect logged-out or authentication-failed sessions", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose("logged_out");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getStatus().state).toBe("logged_out");
    expect(connector.openCount).toBe(1);

    await manager.connect();
    connector.callbacks[1]!.onClose("auth_error");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getStatus().state).toBe("auth_error");
    expect(connector.openCount).toBe(2);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("uses capped exponential backoff without a tight retry loop", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose("transient_error");
    await vi.advanceTimersByTimeAsync(999);
    expect(connector.openCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(connector.openCount).toBe(2);
    expect(computeReconnectDelay(10)).toBe(30_000);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("stops transient reconnects after the configured maximum", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger, output } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      10,
      100,
      3,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose("transient_error");
    await vi.advanceTimersByTimeAsync(10);
    connector.callbacks[1]!.onClose("transient_error");
    await vi.advanceTimersByTimeAsync(20);
    connector.callbacks[2]!.onClose("transient_error");
    await vi.advanceTimersByTimeAsync(40);
    connector.callbacks[3]!.onClose("transient_error");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(connector.openCount).toBe(4);
    expect(manager.getStatus()).toMatchObject({
      state: "transient_error",
      reason: "retry_exhausted",
    });
    expect(output.join("\n")).toContain("wa.connection.retry_exhausted");
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("closes a socket that finishes opening after an explicit disconnect", async () => {
    let resolveSocket: ((socket: GatewaySocket) => void) | undefined;
    const socket: GatewaySocket = { close: vi.fn(async () => undefined) };
    const connector: GatewayConnector = {
      open: () =>
        new Promise<GatewaySocket>((resolve) => {
          resolveSocket = resolve;
        }),
    };
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    const opening = manager.connect();
    await manager.disconnect();
    resolveSocket!(socket);
    await opening;

    expect(socket.close).toHaveBeenCalledOnce();
    expect(manager.getStatus().state).toBe("disconnected");
  });
});
