import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GatewayConfig } from "./config.js";
import { loadGatewayConfig } from "./config.js";
import type { GatewayConnector, GatewayLogger } from "./connection/types.js";
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

function createConnector(): GatewayConnector & { open: ReturnType<typeof vi.fn> } {
  return {
    open: vi.fn(async () => ({ close: vi.fn(async () => undefined) })),
  };
}

describe("WhatsApp gateway startup", () => {
  const runtimes: GatewayRuntime[] = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
  });

  async function startValidRuntime() {
    const parsedConfig = loadGatewayConfig(validGatewayEnvironment);
    const config: GatewayConfig = { ...parsedConfig, port: 0 };
    const connector = createConnector();
    const { logger, entries } = createCapturedLogger();
    const runtime = await startGateway({ config, connector, logger });
    runtimes.push(runtime);
    return { connector, entries, runtime };
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

  it("does not open a Baileys connection during startup", async () => {
    const { connector } = await startValidRuntime();

    expect(connector.open).not.toHaveBeenCalled();
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
