import { describe, expect, it, vi } from "vitest";

import { classifyDisconnect } from "./baileys-connector.js";
import { ConnectionManager, computeReconnectDelay } from "./manager.js";
import { ConnectionStateMachine } from "./state-machine.js";
import type {
  ConnectionCallbacks,
  DisconnectDiagnostic,
  GatewayConnector,
  GatewayLogger,
  GatewayOpenOptions,
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

const transientClose: DisconnectDiagnostic = {
  kind: "transient_error",
  reason: "connection_lost",
  statusCode: 408,
};

const loggedOutClose: DisconnectDiagnostic = {
  kind: "logged_out",
  reason: "logged_out",
  statusCode: 401,
};

const badSessionClose: DisconnectDiagnostic = {
  kind: "auth_error",
  reason: "bad_session",
  statusCode: 500,
};

class FakeConnector implements GatewayConnector {
  callbacks: ConnectionCallbacks[] = [];
  options: GatewayOpenOptions[] = [];
  openCount = 0;
  readonly socket: GatewaySocket = { close: vi.fn(async () => undefined) };

  async open(callbacks: ConnectionCallbacks, options: GatewayOpenOptions): Promise<GatewaySocket> {
    this.openCount += 1;
    this.callbacks.push(callbacks);
    this.options.push(options);
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

  it("allows only one socket when startup reconnect and manual connect overlap", async () => {
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await Promise.all([
      manager.reconnectAtStartup(),
      manager.connect(),
      manager.reconnectAtStartup(),
    ]);

    expect(connector.openCount).toBe(1);
    expect(connector.options).toEqual([{ allowQr: false }]);
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
    const { logger, output } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose(loggedOutClose);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getStatus().state).toBe("logged_out");
    expect(connector.openCount).toBe(1);
    expect(output.join("\n")).toContain('"authStateClassification":"logged_out"');

    await manager.connect();
    connector.callbacks[1]!.onClose(badSessionClose);
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
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(999);
    expect(connector.openCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(connector.openCount).toBe(2);
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((attempt) =>
        computeReconnectDelay(attempt, 1_000, 30_000, () => 0.5),
      ),
    ).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    expect(computeReconnectDelay(10, 1_000, 30_000, () => 0.5)).toBe(30_000);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("keeps QR disabled while retrying a registered startup session", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
    );

    await manager.reconnectAtStartup();
    connector.callbacks[0]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(connector.openCount).toBe(2);
    expect(connector.options).toEqual([{ allowQr: false }, { allowQr: false }]);
    await manager.stop();
    vi.useRealTimers();
  });

  it("cancels transient retry after an explicit disconnect", async () => {
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
    connector.callbacks[0]!.onClose(transientClose);
    await manager.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(connector.openCount).toBe(1);
    expect(manager.getStatus()).toMatchObject({
      state: "disconnected",
      reason: "explicit_disconnect",
    });
    vi.useRealTimers();
  });

  it("cancels reconnect timers during graceful shutdown", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
    );

    await manager.reconnectAtStartup();
    connector.callbacks[0]!.onClose(transientClose);
    await manager.stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(connector.openCount).toBe(1);
    expect(manager.getStatus()).toMatchObject({
      state: "disconnected",
      reason: "shutdown_complete",
    });
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
      undefined,
      () => 0.5,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(10);
    connector.callbacks[1]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(20);
    connector.callbacks[2]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(40);
    connector.callbacks[3]!.onClose(transientClose);
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

  it("reconnects restart-required closes and logs only normalized diagnostics", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger, output } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose({
      kind: "transient_error",
      reason: "restart_required",
      statusCode: 515,
    });

    expect(output.join("\n")).toContain('"normalizedReason":"restart_required"');
    expect(output.join("\n")).toContain('"shouldReconnect":true');
    expect(output.join("\n")).toContain('"nextRetryDelayMs":1000');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(connector.openCount).toBe(2);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("does not create duplicate reconnect timers", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose(transientClose);
    connector.callbacks[0]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(connector.openCount).toBe(2);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("does not include raw disconnect errors or secrets in lifecycle logs", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger, output } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
    );
    const secret = "session-key-material-must-not-be-logged";

    manager.setAuthStateClassification("registered");
    await manager.connect();
    connector.callbacks[0]!.onClose(
      classifyDisconnect({
        message: `restart required ${secret}`,
        output: { statusCode: 515 },
        data: { credential: secret },
      }),
    );

    const serialized = output.join("\n");
    expect(serialized).toContain('"normalizedReason":"restart_required"');
    expect(serialized).toContain('"authStateClassification":"registered"');
    expect(serialized).not.toContain(secret);
    await manager.disconnect();
    vi.useRealTimers();
  });

  it("keeps jittered exponential backoff within the configured bound", () => {
    expect(computeReconnectDelay(0, 1_000, 30_000, () => 0)).toBe(800);
    expect(computeReconnectDelay(0, 1_000, 30_000, () => 1)).toBe(1_200);
    expect(computeReconnectDelay(20, 1_000, 30_000, () => 1)).toBe(30_000);
    expect(computeReconnectDelay(20, 1_000, 30_000, () => 0)).toBe(30_000);
  });

  it("does not reset the retry budget for a briefly opened unstable connection", async () => {
    vi.useFakeTimers();
    const connector = new FakeConnector();
    const { logger } = createLogger();
    const manager = new ConnectionManager(
      connector,
      new ConnectionStateMachine(),
      new QrManager(),
      logger,
      1_000,
      30_000,
      5,
      undefined,
      () => 0.5,
      60_000,
    );

    await manager.connect();
    connector.callbacks[0]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(1_000);
    connector.callbacks[1]!.onOpen();
    connector.callbacks[1]!.onClose(transientClose);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(connector.openCount).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(connector.openCount).toBe(3);

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
    await Promise.resolve();
    await manager.disconnect();
    resolveSocket!(socket);
    await opening;

    expect(socket.close).toHaveBeenCalledOnce();
    expect(manager.getStatus().state).toBe("disconnected");
  });
});
