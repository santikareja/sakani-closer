import { DisconnectReason } from "@whiskeysockets/baileys";
import { describe, expect, it, vi } from "vitest";

import { classifyDisconnect } from "./baileys-connector.js";
import { BaileysConnector } from "./baileys-connector.js";
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
    const handlers = new Map<string, () => void>();
    const socket = {
      ev: {
        on(event: string, handler: () => void) {
          handlers.set(event, handler);
        },
      },
      end: vi.fn(async () => undefined),
    };
    const connector = new BaileysConnector(store, logger, (() => socket) as never);

    await connector.open({ onQr: noop, onOpen: noop, onClose: noop });
    handlers.get("creds.update")!();

    await vi.waitFor(() => {
      expect(values.has("baileys:account:default:credentials")).toBe(true);
    });
  });
});
