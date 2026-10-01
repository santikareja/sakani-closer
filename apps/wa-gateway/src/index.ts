import { pathToFileURL } from "node:url";

import { createLogger } from "@sakani/logger";
import { ZodError } from "zod";

import {
  inspectBaileysAuthState,
  writeBaileysAutoReconnectIntent,
  type BaileysAuthStateInspection,
} from "./auth/baileys-auth-state.js";
import { EncryptedFileAuthStore } from "./auth/encrypted-store.js";
import type { AuthStore } from "./auth/store.js";
import { BaileysConnector } from "./connection/baileys-connector.js";
import {
  ConnectionManager,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from "./connection/manager.js";
import { ConnectionStateMachine } from "./connection/state-machine.js";
import type { GatewayConnector, GatewayLogger } from "./connection/types.js";
import { loadGatewayConfig, type GatewayConfig } from "./config.js";
import { AccountBindingStore } from "./messages/account-binding.js";
import { HttpInboundEventSink } from "./messages/event-sink.js";
import { QrManager } from "./qr/qr-manager.js";
import { closeServer, createGatewayServer, listen } from "./server.js";

export interface GatewayRuntime {
  manager: ConnectionManager;
  server: ReturnType<typeof createGatewayServer>;
  stop(): Promise<void>;
}

export interface StartGatewayOptions {
  config?: GatewayConfig;
  connector?: GatewayConnector;
  logger?: GatewayLogger;
  authStore?: AuthStore;
}

export interface StartupLogger {
  error(bindings: Record<string, unknown>, message?: string): void;
}

export interface StartupDiagnostic extends Record<string, unknown> {
  event: "wa.gateway.start_failed";
  errorType: "configuration" | "startup";
  errorName: string;
  invalidFields?: string[];
  issueCodes?: string[];
  errorCode?: string;
}

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = error.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code) ? code : undefined;
}

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  const allowedNames = new Set([
    "Error",
    "TypeError",
    "RangeError",
    "AuthStoreIntegrityError",
    "ConnectorAuthenticationError",
  ]);
  return allowedNames.has(error.name) ? error.name : "Error";
}

export function createStartupDiagnostic(error: unknown): StartupDiagnostic {
  if (error instanceof ZodError) {
    const invalidFields = [
      ...new Set(
        error.issues.flatMap((issue) => {
          const field = issue.path[0];
          return typeof field === "string" ? [field] : [];
        }),
      ),
    ];
    const issueCodes = [...new Set(error.issues.map((issue) => issue.code))];
    return {
      event: "wa.gateway.start_failed",
      errorType: "configuration",
      errorName: "ZodError",
      invalidFields,
      issueCodes,
    };
  }

  const errorCode = safeErrorCode(error);
  return {
    event: "wa.gateway.start_failed",
    errorType: "startup",
    errorName: safeErrorName(error),
    ...(errorCode ? { errorCode } : {}),
  };
}

export async function startGateway(options: StartGatewayOptions = {}): Promise<GatewayRuntime> {
  const config = options.config ?? loadGatewayConfig();
  const logger =
    options.logger ??
    (createLogger({
      level: config.logLevel,
      base: { service: "wa-gateway" },
    }) as GatewayLogger);
  const authStore =
    options.authStore ??
    new EncryptedFileAuthStore(config.authDataDirectory, config.sessionEncryptionKey);
  const qrManager = new QrManager();
  const stateMachine = new ConnectionStateMachine();
  const accountBindings = new AccountBindingStore(authStore);
  try {
    await accountBindings.load();
  } catch {
    logger.error(
      { event: "wa.account_binding.load_failed" },
      "Binding akun WhatsApp tidak valid; ingestion dinonaktifkan sampai Connect berikutnya",
    );
  }
  const inboundEventSink = new HttpInboundEventSink(
    config.ingestionUrl,
    config.internalServiceToken,
    accountBindings,
    logger,
  );
  const connector =
    options.connector ??
    new BaileysConnector(
      authStore,
      logger,
      undefined,
      inboundEventSink,
      config.sessionEncryptionKey,
    );
  const manager = new ConnectionManager(
    connector,
    stateMachine,
    qrManager,
    logger,
    DEFAULT_RETRY_BASE_DELAY_MS,
    DEFAULT_RETRY_MAX_DELAY_MS,
    DEFAULT_MAX_RETRY_ATTEMPTS,
    {
      setAutoReconnect: (enabled, reason) =>
        writeBaileysAutoReconnectIntent(authStore, enabled, "default", reason),
    },
  );
  const server = createGatewayServer({
    manager,
    qrManager,
    internalServiceToken: config.internalServiceToken,
    logger,
    bindAccount: (binding) => accountBindings.set(binding),
  });

  await listen(server, config.port);
  let autoReconnect = false;
  let authInspection: BaileysAuthStateInspection;
  try {
    authInspection = await inspectBaileysAuthState(authStore);
    manager.setAuthStateClassification(authInspection.classification);
    autoReconnect = authInspection.classification === "registered" && authInspection.autoReconnect;
    if (authInspection.classification === "corrupt") {
      manager.authenticationFailedAtStartup();
      logger.error(
        {
          event: "wa.auth.startup_load_failed",
          authStateClassification: authInspection.classification,
          hasCreds: authInspection.hasCreds,
          hasMe: authInspection.hasMe,
          registeredFlag: authInspection.registeredFlag,
          hasKeys: authInspection.hasKeys,
          authDirectory: config.authDataDirectory,
          state: manager.getStatus().state,
          reason: authInspection.reason,
        },
        "Session WhatsApp tersimpan tidak valid dan tidak akan dicoba ulang",
      );
    }
    if (autoReconnect) await manager.reconnectAtStartup();
  } catch {
    manager.authenticationFailedAtStartup();
    authInspection = {
      classification: "corrupt",
      hasCreds: false,
      hasMe: false,
      registeredFlag: false,
      hasKeys: false,
      autoReconnect: false,
      reason: "corrupt_auth_state",
    };
    logger.error(
      {
        event: "wa.auth.startup_load_failed",
        authStateClassification: "corrupt",
        hasCreds: false,
        hasMe: false,
        registeredFlag: false,
        hasKeys: false,
        authDirectory: config.authDataDirectory,
        state: manager.getStatus().state,
        reason: "integrity_validation_failed",
      },
      "Session WhatsApp terenkripsi gagal divalidasi dan tidak akan dicoba ulang",
    );
  }
  const startupState = manager.getStatus().state;
  logger.info(
    {
      event: "wa.gateway.started",
      port: config.port,
      autoReconnect,
      authStateClassification: authInspection.classification,
      hasCreds: authInspection.hasCreds,
      hasMe: authInspection.hasMe,
      registeredFlag: authInspection.registeredFlag,
      hasKeys: authInspection.hasKeys,
      authDirectory: config.authDataDirectory,
      state: startupState,
      reason: authInspection.reason,
    },
    autoReconnect
      ? "Gateway WhatsApp memulai reconnect session tersimpan"
      : authInspection.classification === "registered"
        ? "Gateway WhatsApp siap dengan reconnect session dinonaktifkan"
        : "Gateway WhatsApp siap tanpa session yang dapat dipulihkan",
  );

  let stopPromise: Promise<void> | undefined;
  const stop = () => {
    stopPromise ??= (async () => {
      await manager.stop();
      await inboundEventSink.flush();
      await closeServer(server);
    })();
    return stopPromise;
  };

  return { manager, server, stop };
}

export async function runGatewayEntrypoint(
  start: () => Promise<GatewayRuntime> = startGateway,
  logger: StartupLogger = createLogger({ level: "info", base: { service: "wa-gateway" } }),
): Promise<GatewayRuntime | undefined> {
  try {
    return await start();
  } catch (error) {
    logger.error(
      createStartupDiagnostic(error),
      "Gateway WhatsApp gagal dimulai; periksa field atau kode error startup",
    );
    return undefined;
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void runGatewayEntrypoint().then((runtime) => {
    if (!runtime) {
      process.exitCode = 1;
      return;
    }

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void runtime.stop();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  });
}
