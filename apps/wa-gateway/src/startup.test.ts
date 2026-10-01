import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GatewayConfig } from "./config.js";
import { loadGatewayConfig } from "./config.js";
import {
  createBaileysAuthState,
  inspectBaileysAuthState,
  readBaileysAutoReconnectIntent,
  writeBaileysAutoReconnectIntent,
} from "./auth/baileys-auth-state.js";
import { EncryptedFileAuthStore } from "./auth/encrypted-store.js";
import type {
  ConnectionCallbacks,
  GatewayConnector,
  GatewayLogger,
  GatewayOpenOptions,
  GatewaySocket,
} from "./connection/types.js";
import {
  runGatewayEntrypoint,
  startGateway,
  type GatewayRuntime,
  type StartupLogger,
} from "./index.js";

const encryptionSecret = "encryption-secret-material-".padEnd(64, "e");
const internalToken = "internal-service-token-".padEnd(64, "t");

const validGatewayEnvironment = {
  NODE_ENV: "test",
  WA_GATEWAY_PORT: "3001",
  WA_AUTH_DATA_DIR: "./wa-auth-test",
  WA_LOG_LEVEL: "silent",
  SESSION_ENCRYPTION_KEY: encryptionSecret,
  INTERNAL_SERVICE_TOKEN: internalToken,
};

function createCapturedLogger(): {
  entries: Array<{ bindings: Record<string, unknown>; message?: string }>;
  logger: GatewayLogger & StartupLogger;
} {
  const entries: Array<{ bindings: Record<string, unknown>; message?: string }> = [];
  const write = (bindings: Record<string, unknown>, message?: string) => {
    entries.push({ bindings, ...(message ? { message } : {}) });
  };
  return {
    entries,
    logger: { debug: write, info: write, warn: write, error: write },
  };
}

class CapturedConnector implements GatewayConnector {
  callbacks: ConnectionCallbacks | undefined;
  options: GatewayOpenOptions | undefined;
  readonly socket: GatewaySocket = { close: vi.fn(async () => undefined) };
  readonly open = vi.fn(
    async (callbacks: ConnectionCallbacks, options: GatewayOpenOptions): Promise<GatewaySocket> => {
      this.callbacks = callbacks;
      this.options = options;
      return this.socket;
    },
  );
}

function createConnector(): CapturedConnector {
  return new CapturedConnector();
}

describe("WhatsApp gateway startup", () => {
  const runtimes: GatewayRuntime[] = [];
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function startValidRuntime(hasRegisteredSession = false, autoReconnectIntent?: boolean) {
    const authDataDirectory = await mkdtemp(path.join(tmpdir(), "sakani-wa-startup-test-"));
    temporaryDirectories.push(authDataDirectory);
    const parsedConfig = loadGatewayConfig(validGatewayEnvironment);
    const config: GatewayConfig = { ...parsedConfig, port: 0, authDataDirectory };
    const authStore = new EncryptedFileAuthStore(authDataDirectory, encryptionSecret);
    if (hasRegisteredSession) {
      const auth = await createBaileysAuthState(authStore);
      auth.state.creds.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
      auth.state.creds.registered = false;
      await auth.saveCreds();
      await auth.state.keys.set({ session: { existing: new Uint8Array([1, 2, 3]) } });
    }
    if (autoReconnectIntent !== undefined) {
      await writeBaileysAutoReconnectIntent(authStore, autoReconnectIntent);
    }
    const connector = createConnector();
    const { logger, entries } = createCapturedLogger();
    const runtime = await startGateway({ config, connector, logger, authStore });
    runtimes.push(runtime);
    return { authStore, connector, entries, runtime };
  }

  it("starts with a valid gateway-only configuration", async () => {
    const { runtime } = await startValidRuntime();

    expect(runtime.server.listening).toBe(true);
    expect(runtime.manager.getStatus().state).toBe("disconnected");
  });

  it("fails clearly when the internal service token is missing", async () => {
    const { logger, entries } = createCapturedLogger();
    const runtime = await runGatewayEntrypoint(
      async () =>
        startGateway({
          config: loadGatewayConfig({
            ...validGatewayEnvironment,
            INTERNAL_SERVICE_TOKEN: undefined,
          }),
        }),
      logger,
    );
    const serialized = JSON.stringify(entries);

    expect(runtime).toBeUndefined();
    expect(serialized).toContain("INTERNAL_SERVICE_TOKEN");
    expect(serialized).toContain("configuration");
    expect(serialized).not.toContain(encryptionSecret);
  });

  it("fails clearly when the session encryption key is missing", async () => {
    const { logger, entries } = createCapturedLogger();
    const runtime = await runGatewayEntrypoint(
      async () =>
        startGateway({
          config: loadGatewayConfig({
            ...validGatewayEnvironment,
            SESSION_ENCRYPTION_KEY: undefined,
          }),
        }),
      logger,
    );
    const serialized = JSON.stringify(entries);

    expect(runtime).toBeUndefined();
    expect(serialized).toContain("SESSION_ENCRYPTION_KEY");
    expect(serialized).toContain("configuration");
    expect(serialized).not.toContain(internalToken);
  });

  it("serves health while WhatsApp is disconnected", async () => {
    const { runtime } = await startValidRuntime();
    const address = runtime.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = (await response.json()) as { connection: { state: string }; status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.connection.state).toBe("disconnected");
  });

  it("stays disconnected and does not create a socket without a stored session", async () => {
    const { connector } = await startValidRuntime();

    expect(connector.open).not.toHaveBeenCalled();
  });

  it("reconnects automatically when reusable credentials have me but registered is false", async () => {
    const { connector, entries, runtime } = await startValidRuntime(true);

    expect(connector.open).toHaveBeenCalledOnce();
    expect(connector.options).toEqual({ allowQr: false });
    expect(runtime.manager.getStatus()).toMatchObject({
      state: "connecting",
      reason: "service_started",
    });
    expect(entries).toContainEqual(
      expect.objectContaining({
        bindings: expect.objectContaining({
          event: "wa.gateway.started",
          autoReconnect: true,
          authStateClassification: "registered",
          hasCreds: true,
          hasMe: true,
          registeredFlag: false,
          hasKeys: true,
        }),
      }),
    );

    connector.callbacks!.onOpen("62812****789");
    expect(runtime.manager.getStatus()).toMatchObject({
      state: "connected",
      phoneNumberMasked: "62812****789",
    });
  });

  it("honors a persisted explicit disconnect after restart", async () => {
    const { connector, entries, runtime } = await startValidRuntime(true, false);

    expect(connector.open).not.toHaveBeenCalled();
    expect(runtime.manager.getStatus()).toMatchObject({
      state: "disconnected",
      reason: "service_started",
    });
    expect(entries).toContainEqual(
      expect.objectContaining({
        bindings: expect.objectContaining({
          event: "wa.gateway.started",
          authStateClassification: "registered",
          autoReconnect: false,
          reason: "explicit_disconnect",
        }),
      }),
    );
  });

  it("distinguishes missing, unregistered, registered, logged-out, reset, and corrupt state", async () => {
    const authDataDirectory = await mkdtemp(path.join(tmpdir(), "sakani-wa-inspection-test-"));
    temporaryDirectories.push(authDataDirectory);
    const store = new EncryptedFileAuthStore(authDataDirectory, encryptionSecret);

    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "missing",
      reason: "missing_auth_state",
    });
    const auth = await createBaileysAuthState(store);
    await auth.saveCreds();
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "unregistered",
      hasCreds: true,
      hasMe: false,
      registeredFlag: false,
      reason: "unregistered_auth_state",
    });
    auth.state.creds.registered = true;
    await auth.saveCreds();
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "unregistered",
      hasMe: false,
      registeredFlag: true,
    });
    auth.state.creds.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
    auth.state.creds.registered = false;
    await auth.saveCreds();
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "registered",
      hasMe: true,
      registeredFlag: false,
      hasKeys: false,
      autoReconnect: true,
    });
    await store.delete("baileys:account:default:credentials");
    await writeBaileysAutoReconnectIntent(store, false, "default", "logged_out");
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "logged_out",
      reason: "logged_out",
    });
    await writeBaileysAutoReconnectIntent(store, false, "default", "explicit_reset");
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "missing",
      reason: "explicit_reset",
    });
    await store.write("baileys:account:default:credentials", { registered: "invalid" });
    await expect(inspectBaileysAuthState(store)).resolves.toMatchObject({
      classification: "corrupt",
      reason: "corrupt_auth_state",
    });
  });

  it("keeps HTTP alive but blocks reconnect for invalid stored auth state", async () => {
    const authDataDirectory = await mkdtemp(path.join(tmpdir(), "sakani-wa-invalid-test-"));
    temporaryDirectories.push(authDataDirectory);
    const parsedConfig = loadGatewayConfig(validGatewayEnvironment);
    const config: GatewayConfig = { ...parsedConfig, port: 0, authDataDirectory };
    const authStore = new EncryptedFileAuthStore(authDataDirectory, encryptionSecret);
    await authStore.write("baileys:account:default:credentials", { registered: "invalid" });
    const connector = createConnector();
    const { logger, entries } = createCapturedLogger();
    const runtime = await startGateway({ config, connector, logger, authStore });
    runtimes.push(runtime);

    expect(runtime.server.listening).toBe(true);
    expect(runtime.manager.getStatus().state).toBe("auth_error");
    expect(connector.open).not.toHaveBeenCalled();
    const serialized = JSON.stringify(entries);
    expect(serialized).toContain('"authStateClassification":"corrupt"');
    expect(serialized).not.toContain(encryptionSecret);
    expect(serialized).not.toContain(internalToken);
  });

  it("classifies undecryptable auth state as corrupt without a reconnect loop", async () => {
    const authDataDirectory = await mkdtemp(path.join(tmpdir(), "sakani-wa-corrupt-test-"));
    temporaryDirectories.push(authDataDirectory);
    const writer = new EncryptedFileAuthStore(authDataDirectory, encryptionSecret);
    const auth = await createBaileysAuthState(writer);
    auth.state.creds.me = { id: "628123456789:1@s.whatsapp.net", name: "Owner" };
    await auth.saveCreds();

    const wrongEncryptionSecret = "different-encryption-material-".padEnd(64, "x");
    const unreadableStore = new EncryptedFileAuthStore(authDataDirectory, wrongEncryptionSecret);
    const parsedConfig = loadGatewayConfig(validGatewayEnvironment);
    const config: GatewayConfig = { ...parsedConfig, port: 0, authDataDirectory };
    const connector = createConnector();
    const { logger, entries } = createCapturedLogger();
    const runtime = await startGateway({ config, connector, logger, authStore: unreadableStore });
    runtimes.push(runtime);

    expect(runtime.manager.getStatus().state).toBe("auth_error");
    expect(connector.open).not.toHaveBeenCalled();
    expect(JSON.stringify(entries)).toContain('"authStateClassification":"corrupt"');
    expect(JSON.stringify(entries)).not.toContain(wrongEncryptionSecret);
  });

  it("persists explicit disconnect without deleting registered credentials", async () => {
    const { authStore, connector, runtime } = await startValidRuntime(true);
    connector.callbacks!.onOpen("62812****789");

    await runtime.manager.disconnect();

    expect(await readBaileysAutoReconnectIntent(authStore)).toBe(false);
    const restored = await createBaileysAuthState(authStore);
    expect(restored.state.creds.me?.id).toBe("628123456789:1@s.whatsapp.net");
    expect((await inspectBaileysAuthState(authStore)).classification).toBe("registered");

    await runtime.manager.connect();
    expect(await readBaileysAutoReconnectIntent(authStore)).toBe(true);
  });

  it("does not publish or request QR during registered-session startup", async () => {
    const { connector, runtime } = await startValidRuntime(true);
    const address = runtime.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/internal/qr`, {
      headers: { authorization: `Bearer ${internalToken}` },
    });

    expect(connector.options).toEqual({ allowQr: false });
    expect(response.status).toBe(404);
  });

  it("shuts down the active socket before closing the HTTP server", async () => {
    const { connector, runtime } = await startValidRuntime(true);

    await runtime.stop();

    expect(connector.socket.close).toHaveBeenCalledOnce();
    expect(runtime.server.listening).toBe(false);
  });

  it("never includes configured secrets in startup diagnostics", async () => {
    const { logger, entries } = createCapturedLogger();
    await runGatewayEntrypoint(
      async () =>
        startGateway({
          config: loadGatewayConfig({ ...validGatewayEnvironment, WA_GATEWAY_PORT: "invalid" }),
        }),
      logger,
    );
    const serialized = JSON.stringify(entries);

    expect(serialized).toContain("WA_GATEWAY_PORT");
    expect(serialized).not.toContain(encryptionSecret);
    expect(serialized).not.toContain(internalToken);
  });
});
