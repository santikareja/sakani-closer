import { DisconnectReason } from "@whiskeysockets/baileys";
import { describe, expect, it, vi } from "vitest";

import { BaileysConnector, classifyDisconnect, maskPhoneNumber } from "./baileys-connector.js";
import type { AuthStore } from "../auth/store.js";
import type { GatewayLogger } from "./types.js";

function boomLike(statusCode: number) {
  return { output: { statusCode } };
}

describe("Baileys disconnect classification", () => {
  it("distinguishes logout, authentication failure, and transient errors", () => {
    expect(classifyDisconnect(boomLike(DisconnectReason.loggedOut))).toBe("logged_out");
    expect(classifyDisconnect(boomLike(DisconnectReason.badSession))).toBe("auth_error");
    expect(classifyDisconnect(boomLike(DisconnectReason.forbidden))).toBe("auth_error");
    expect(classifyDisconnect(boomLike(DisconnectReason.connectionLost))).toBe("transient_error");
    expect(classifyDisconnect(new Error("network"))).toBe("transient_error");
  });

  it("masks phone numbers without retaining the full value", () => {
    expect(maskPhoneNumber("+62 812-3456-789")).toBe("62812****789");
    expect(maskPhoneNumber("1234")).toBeUndefined();
  });

  it("always persists credential update events through the auth store", async () => {
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
    const connector = new BaileysConnector(store, logger, (() => socket) as never);
    const onOpen = vi.fn();

    const gatewaySocket = await connector.open({ onQr: noop, onOpen, onClose: noop });
    handlers.get("creds.update")!();
    handlers.get("connection.update")!({ connection: "open" });

    await vi.waitFor(() => {
      expect(values.has("baileys:account:default:credentials")).toBe(true);
    });
    expect(onOpen).toHaveBeenCalledWith("62812****789");
    expect(sendMessage).not.toHaveBeenCalled();

    await gatewaySocket.close();
    expect(socket.end).toHaveBeenCalledOnce();
    expect(logout).not.toHaveBeenCalled();
    expect(values.has("baileys:account:default:credentials")).toBe(true);
  });

  it("clears invalid auth data on logout without reconnecting or sending", async () => {
    const values = new Map<string, unknown>([
      ["baileys:account:default:credentials", { registered: true }],
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
    await connector.open({ onQr: noop, onOpen: noop, onClose });

    handlers.get("connection.update")!({
      connection: "close",
      lastDisconnect: { error: boomLike(DisconnectReason.loggedOut) },
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith("logged_out"));
    expect(values.size).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
