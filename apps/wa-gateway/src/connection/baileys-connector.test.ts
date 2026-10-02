import {
  DEFAULT_CONNECTION_CONFIG,
  DisconnectReason,
  initAuthCreds,
  PROCESSABLE_HISTORY_TYPES,
  proto,
  type AuthenticationState,
} from "@whiskeysockets/baileys";
import { describe, expect, it, vi } from "vitest";

import {
  BaileysConnector,
  classifyDisconnect,
  createSafeBaileysLogger,
  maskPhoneNumber,
} from "./baileys-connector.js";
import { inspectBaileysAuthState } from "../auth/baileys-auth-state.js";
import type { AuthStore } from "../auth/store.js";
import type { InboundEventSink } from "../messages/event-sink.js";
import type { GatewayLogger } from "./types.js";

function boomLike(statusCode: number) {
  return { output: { statusCode } };
}

describe("Baileys disconnect classification", () => {
  it("distinguishes logout, authentication failure, and transient errors", () => {
    expect(classifyDisconnect(boomLike(DisconnectReason.loggedOut))).toEqual({
      kind: "logged_out",
      reason: "logged_out",
      statusCode: 401,
    });
    expect(classifyDisconnect(boomLike(DisconnectReason.badSession))).toMatchObject({
      kind: "auth_error",
      reason: "bad_session",
    });
    expect(classifyDisconnect(boomLike(DisconnectReason.connectionReplaced))).toMatchObject({
      kind: "auth_error",
      reason: "connection_replaced",
    });
    expect(classifyDisconnect(boomLike(DisconnectReason.forbidden))).toMatchObject({
      kind: "auth_error",
      reason: "forbidden",
    });
    expect(classifyDisconnect(boomLike(DisconnectReason.restartRequired))).toEqual({
      kind: "transient_error",
      reason: "restart_required",
      statusCode: 515,
    });
    expect(
      classifyDisconnect({
        message: "Timed Out",
        output: { statusCode: DisconnectReason.timedOut },
      }),
    ).toMatchObject({ kind: "transient_error", reason: "timed_out" });
    expect(classifyDisconnect(boomLike(DisconnectReason.connectionLost))).toMatchObject({
      kind: "transient_error",
      reason: "connection_lost",
    });
    expect(classifyDisconnect(new Error("network"))).toEqual({
      kind: "transient_error",
      reason: "unknown_transient",
    });
  });

  it("masks phone numbers without retaining the full value", () => {
    expect(maskPhoneNumber("+62 812-3456-789")).toBe("62812****789");
    expect(maskPhoneNumber("1234")).toBeUndefined();
  });

  it("drops raw Baileys bindings and messages before they reach application logs", () => {
    const output: string[] = [];
    const write = (bindings: Record<string, unknown>, message?: string) => {
      output.push(JSON.stringify({ bindings, message }));
    };
    const logger: GatewayLogger = { debug: write, info: write, warn: write, error: write };
    const safeLogger = createSafeBaileysLogger(logger);
    const secret = "628123456789@s.whatsapp.net";

    safeLogger.info({ me: { id: secret }, creds: secret }, `paired ${secret}`);
    safeLogger.child({ session: secret }).warn({ error: secret }, secret);

    expect(output.join("\n")).toContain("wa.baileys.info");
    expect(output.join("\n")).not.toContain(secret);
  });

  it("persists manual-login credentials that startup classifies as registered", async () => {
    const values = new Map<string, unknown>();
    const store: AuthStore = {
      async read<T>(key: string) {
        return values.get(key) as T | undefined;
      },
      async write(key, value) {
        values.set(key, value);
      },
      async delete(key) {
        values.delete(key);
      },
      async list(prefix = "") {
        return [...values.keys()].filter((key) => key.startsWith(prefix));
      },
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    const sendMessage = vi.fn();
    const logout = vi.fn();
    const socket = {
      user: { id: "628123456789@s.whatsapp.net" },
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
      logout,
      sendMessage,
    };
    let socketAuth: AuthenticationState | undefined;
    const socketFactory = vi.fn((options: { auth: AuthenticationState }) => {
      socketAuth = options.auth;
      return socket;
    });
    const connector = new BaileysConnector(store, logger, socketFactory as never);
    const onOpen = vi.fn();

    const gatewaySocket = await connector.open(
      { onQr: noop, onOpen, onClose: noop },
      { allowQr: true },
    );
    socketAuth!.creds.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
    socketAuth!.creds.registered = false;
    await socketAuth!.keys.set({ session: { existing: new Uint8Array([1, 2, 3]) } });
    handlers.get("creds.update")!();
    handlers.get("connection.update")!({ connection: "open" });

    await vi.waitFor(() => {
      expect(values.has("baileys:account:default:credentials")).toBe(true);
      expect(onOpen).toHaveBeenCalledWith("62812****789");
    });
    expect(await inspectBaileysAuthState(store)).toMatchObject({
      classification: "registered",
      hasCreds: true,
      hasMe: true,
      registeredFlag: false,
      hasKeys: true,
    });
    expect(sendMessage).not.toHaveBeenCalled();

    await gatewaySocket.close();
    expect(socket.end).toHaveBeenCalledOnce();
    expect(logout).not.toHaveBeenCalled();
    expect(values.has("baileys:account:default:credentials")).toBe(true);
  });

  it("preserves encrypted auth data on logout without reconnecting or sending", async () => {
    const credentials = initAuthCreds();
    credentials.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
    credentials.registered = true;
    const values = new Map<string, unknown>([
      ["baileys:account:default:credentials", credentials],
      ["baileys:account:default:key:session:one", { key: "encrypted-by-adapter" }],
    ]);
    const store: AuthStore = {
      async read<T>(key: string) {
        return values.get(key) as T | undefined;
      },
      async write(key, value) {
        values.set(key, value);
      },
      async delete(key) {
        values.delete(key);
      },
      async list(prefix = "") {
        return [...values.keys()].filter((key) => key.startsWith(prefix));
      },
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    const sendMessage = vi.fn();
    const socket = {
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
      sendMessage,
    };
    const onClose = vi.fn();
    const connector = new BaileysConnector(store, logger, (() => socket) as never);
    await connector.open({ onQr: noop, onOpen: noop, onClose }, { allowQr: true });

    handlers.get("connection.update")!({
      connection: "close",
      lastDisconnect: { error: boomLike(DisconnectReason.loggedOut) },
    });

    await vi.waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({
        kind: "logged_out",
        reason: "logged_out",
        statusCode: 401,
      }),
    );
    expect(values.has("baileys:account:default:credentials")).toBe(true);
    expect(values.has("baileys:account:default:key:session:one")).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("suppresses QR for a registered-session reconnect", async () => {
    const values = new Map<string, unknown>();
    const store: AuthStore = {
      async read<T>(key: string) {
        return values.get(key) as T | undefined;
      },
      async write(key, value) {
        values.set(key, value);
      },
      async delete(key) {
        values.delete(key);
      },
      async list(prefix = "") {
        return [...values.keys()].filter((key) => key.startsWith(prefix));
      },
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    const socket = {
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
    };
    const onQr = vi.fn();
    const onClose = vi.fn();
    const connector = new BaileysConnector(store, logger, (() => socket) as never);
    await connector.open({ onQr, onOpen: noop, onClose }, { allowQr: false });

    handlers.get("connection.update")!({ qr: "must-not-be-published" });

    expect(onQr).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith({
      kind: "auth_error",
      reason: "unexpected_qr",
    });
    expect(socket.end).toHaveBeenCalledOnce();
  });

  it("enables supported full history sync without disabling init queries", async () => {
    const store: AuthStore = {
      read: vi.fn(async () => undefined),
      write: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const socket = {
      ev: { on: vi.fn() },
      end: vi.fn(async () => undefined),
    };
    const socketFactory = vi.fn((_options: Record<string, unknown>) => socket);
    const connector = new BaileysConnector(store, logger, socketFactory as never);

    await connector.open({ onQr: noop, onOpen: noop, onClose: noop }, { allowQr: true });

    const options = socketFactory.mock.calls[0]![0] as Record<string, unknown>;
    expect(options.syncFullHistory).toBe(true);
    expect(options.shouldSyncHistoryMessage).toBeTypeOf("function");
    expect(
      (options.shouldSyncHistoryMessage as (value: { syncType: number }) => boolean)({
        syncType: proto.HistorySync.HistorySyncType.FULL,
      }),
    ).toBe(true);
    expect(options).not.toHaveProperty("fireInitQueries");
    expect(PROCESSABLE_HISTORY_TYPES).toContain(
      proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
    );
    expect(
      DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage({
        syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
      }),
    ).toBe(true);
    expect(
      DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage({
        syncType: proto.HistorySync.HistorySyncType.RECENT,
      }),
    ).toBe(true);
    expect(
      DEFAULT_CONNECTION_CONFIG.shouldSyncHistoryMessage({
        syncType: proto.HistorySync.HistorySyncType.FULL,
      }),
    ).toBe(false);
  });

  it("flushes pending credential writes before reporting a transient close", async () => {
    let finishWrite: (() => void) | undefined;
    const writeFinished = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const store: AuthStore = {
      read: vi.fn(async () => undefined),
      write: vi.fn(() => writeFinished),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    const socket = {
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
    };
    const onClose = vi.fn();
    const connector = new BaileysConnector(store, logger, (() => socket) as never);
    await connector.open({ onQr: noop, onOpen: noop, onClose }, { allowQr: true });
    handlers.get("creds.update")!();
    handlers.get("connection.update")!({
      connection: "close",
      lastDisconnect: { error: boomLike(DisconnectReason.restartRequired) },
    });

    await Promise.resolve();
    expect(onClose).not.toHaveBeenCalled();
    finishWrite!();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(store.flush).toHaveBeenCalledOnce();
  });

  it("persists the latest credentials before reporting the socket as connected", async () => {
    let finishWrite: (() => void) | undefined;
    const writeFinished = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const store: AuthStore = {
      read: vi.fn(async () => undefined),
      write: vi.fn(() => writeFinished),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    let socketAuth: AuthenticationState | undefined;
    const socket = {
      user: { id: "628123456789@s.whatsapp.net" },
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
    };
    const socketFactory = vi.fn((options: { auth: AuthenticationState }) => {
      socketAuth = options.auth;
      return socket;
    });
    const onOpen = vi.fn();
    const connector = new BaileysConnector(store, logger, socketFactory as never);
    await connector.open({ onQr: noop, onOpen, onClose: noop }, { allowQr: true });
    socketAuth!.creds.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
    socketAuth!.creds.registered = false;

    handlers.get("connection.update")!({ connection: "open" });
    await Promise.resolve();
    expect(onOpen).not.toHaveBeenCalled();

    finishWrite!();
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith("62812****789"));
    expect(store.flush).toHaveBeenCalledOnce();
  });

  it("waits for pending credential writes before socket close completes", async () => {
    let finishWrite: (() => void) | undefined;
    const writeFinished = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const store: AuthStore = {
      read: vi.fn(async () => undefined),
      write: vi.fn(() => writeFinished),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (update?: Record<string, unknown>) => void>();
    const socket = {
      ev: {
        on(event: string, handler: (update?: Record<string, unknown>) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
    };
    const connector = new BaileysConnector(store, logger, (() => socket) as never);
    const gatewaySocket = await connector.open(
      { onQr: noop, onOpen: noop, onClose: noop },
      { allowQr: true },
    );
    handlers.get("creds.update")!();
    const closePromise = gatewaySocket.close();

    await Promise.resolve();
    expect(store.flush).not.toHaveBeenCalled();
    finishWrite!();
    await closePromise;

    expect(store.flush).toHaveBeenCalledOnce();
  });

  it("publishes inbound events without invoking Baileys sendMessage", async () => {
    const store: AuthStore = {
      read: vi.fn(async () => undefined),
      write: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      flush: vi.fn(async () => undefined),
    };
    const noop = () => undefined;
    const logger: GatewayLogger = { debug: noop, info: noop, warn: noop, error: noop };
    const handlers = new Map<string, (event: never) => void>();
    const sendMessage = vi.fn();
    const socket = {
      ev: {
        on(event: string, handler: (event: never) => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
      sendMessage,
    };
    const sink: InboundEventSink = {
      publish: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
    };
    const connector = new BaileysConnector(
      store,
      logger,
      (() => socket) as never,
      sink,
      "identifier-hash-key-with-at-least-32-characters",
    );
    const gatewaySocket = await connector.open(
      { onQr: noop, onOpen: noop, onClose: noop },
      { allowQr: true },
    );

    handlers.get("messages.upsert")!({
      type: "notify",
      messages: [
        {
          key: {
            id: "provider-1",
            remoteJid: "628123456789@s.whatsapp.net",
            fromMe: false,
          },
          messageTimestamp: 1_790_812_800,
          message: { conversation: "Halo" },
        },
      ],
    } as never);

    await gatewaySocket.close();
    expect(sink.publish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accepted", messageType: "text" }),
    );
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sink.flush).toHaveBeenCalledOnce();
  });
});
