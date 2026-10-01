import makeWASocket, {
  DisconnectReason,
  isJidBroadcast,
  isJidGroup,
  jidDecode,
} from "@whiskeysockets/baileys";

import { clearBaileysAuthState, createBaileysAuthState } from "../auth/baileys-auth-state.js";
import type { AuthStore } from "../auth/store.js";
import type {
  ConnectionCallbacks,
  DisconnectDiagnostic,
  GatewayConnector,
  GatewayLogger,
  GatewayOpenOptions,
  GatewaySocket,
} from "./types.js";

export class ConnectorAuthenticationError extends Error {
  constructor() {
    super("WhatsApp authentication state could not be loaded");
    this.name = "ConnectorAuthenticationError";
  }
}

function getDisconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("output" in error)) return undefined;
  const output = error.output;
  if (!output || typeof output !== "object" || !("statusCode" in output)) return undefined;
  return typeof output.statusCode === "number" ? output.statusCode : undefined;
}

function getDisconnectMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error)) return undefined;
  return typeof error.message === "string" ? error.message : undefined;
}

export function classifyDisconnect(error: unknown): DisconnectDiagnostic {
  const code = getDisconnectStatusCode(error);
  if (code === DisconnectReason.loggedOut) {
    return { kind: "logged_out", reason: "logged_out", statusCode: code };
  }
  if (code === DisconnectReason.badSession) {
    return { kind: "auth_error", reason: "bad_session", statusCode: code };
  }
  if (code === DisconnectReason.connectionReplaced) {
    return { kind: "auth_error", reason: "connection_replaced", statusCode: code };
  }
  if (code === DisconnectReason.multideviceMismatch) {
    return { kind: "auth_error", reason: "multidevice_mismatch", statusCode: code };
  }
  if (code === DisconnectReason.forbidden) {
    return { kind: "auth_error", reason: "forbidden", statusCode: code };
  }
  if (code === DisconnectReason.restartRequired) {
    return { kind: "transient_error", reason: "restart_required", statusCode: code };
  }
  if (code === DisconnectReason.connectionLost) {
    const timedOut = /timed?\s*out/i.test(getDisconnectMessage(error) ?? "");
    return {
      kind: "transient_error",
      reason: timedOut ? "timed_out" : "connection_lost",
      statusCode: code,
    };
  }
  if (code === DisconnectReason.connectionClosed) {
    const serverClose = /server/i.test(getDisconnectMessage(error) ?? "");
    return {
      kind: "transient_error",
      reason: serverClose ? "server_connection_close" : "connection_closed",
      statusCode: code,
    };
  }
  if (code === DisconnectReason.unavailableService) {
    return { kind: "transient_error", reason: "service_unavailable", statusCode: code };
  }
  return {
    kind: "transient_error",
    reason: "unknown_transient",
    ...(code === undefined ? {} : { statusCode: code }),
  };
}

export function maskPhoneNumber(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
}

function getMaskedSocketIdentity(socket: {
  user?: { id: string; phoneNumber?: string | null | undefined } | undefined;
}) {
  const phoneNumber = socket.user?.phoneNumber ?? undefined;
  if (phoneNumber) return maskPhoneNumber(phoneNumber);
  return maskPhoneNumber(jidDecode(socket.user?.id ?? "")?.user);
}

interface SafeBaileysLogger {
  level: string;
  child(bindings: Record<string, unknown>): SafeBaileysLogger;
  trace(bindings: unknown, message?: string): void;
  debug(bindings: unknown, message?: string): void;
  info(bindings: unknown, message?: string): void;
  warn(bindings: unknown, message?: string): void;
  error(bindings: unknown, message?: string): void;
}

export function createSafeBaileysLogger(logger: GatewayLogger): SafeBaileysLogger {
  const safeLogger: SafeBaileysLogger = {
    level: "info",
    child: () => safeLogger,
    trace: () => logger.debug({ event: "wa.baileys.trace" }, "Diagnostic internal Baileys"),
    debug: () => logger.debug({ event: "wa.baileys.debug" }, "Diagnostic internal Baileys"),
    info: () => logger.info({ event: "wa.baileys.info" }, "Diagnostic internal Baileys"),
    warn: () => logger.warn({ event: "wa.baileys.warn" }, "Diagnostic internal Baileys"),
    error: () => logger.error({ event: "wa.baileys.error" }, "Diagnostic internal Baileys"),
  };
  return safeLogger;
}

export class BaileysConnector implements GatewayConnector {
  constructor(
    private readonly authStore: AuthStore,
    private readonly logger: GatewayLogger,
    private readonly socketFactory: typeof makeWASocket = makeWASocket,
  ) {}

  async open(callbacks: ConnectionCallbacks, options: GatewayOpenOptions): Promise<GatewaySocket> {
    let auth: Awaited<ReturnType<typeof createBaileysAuthState>>;
    try {
      auth = await createBaileysAuthState(this.authStore);
    } catch {
      throw new ConnectorAuthenticationError();
    }

    const socket = this.socketFactory({
      auth: auth.state,
      logger: createSafeBaileysLogger(this.logger),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      enableRecentMessageCache: false,
      shouldIgnoreJid: (jid) => Boolean(isJidGroup(jid) || isJidBroadcast(jid)),
      getMessage: async () => undefined,
    });

    let closed = false;
    let openReported = false;
    let pendingCredentialWrites = Promise.resolve();
    const queueCredentialWrite = () => {
      const write = pendingCredentialWrites.catch(() => undefined).then(auth.saveCreds);
      pendingCredentialWrites = write;
      return write;
    };
    const flushCredentialWrites = async () => {
      await pendingCredentialWrites;
      await this.authStore.flush();
    };
    const reportPersistenceFailure = () => {
      if (closed) return;
      closed = true;
      this.logger.error({ event: "wa.auth.persist_failed" }, "Gagal menyimpan kredensial WhatsApp");
      callbacks.onClose({ kind: "auth_error", reason: "auth_persistence_failed" });
      void socket.end(new Error("auth_persistence_failed"));
    };
    socket.ev.on("creds.update", () => {
      if (closed) return;
      void queueCredentialWrite().catch(reportPersistenceFailure);
    });

    socket.ev.on("connection.update", (update) => {
      if (update.qr && options.allowQr) callbacks.onQr(update.qr);
      if (update.qr && !options.allowQr && !closed) {
        closed = true;
        callbacks.onClose({ kind: "auth_error", reason: "unexpected_qr" });
        void socket.end(new Error("unexpected_qr_for_registered_session"));
        return;
      }
      if (update.connection === "open" && !closed && !openReported) {
        openReported = true;
        void queueCredentialWrite()
          .then(flushCredentialWrites)
          .then(() => {
            if (!closed) callbacks.onOpen(getMaskedSocketIdentity(socket));
          })
          .catch(reportPersistenceFailure);
      }
      if (update.connection === "close" && !closed) {
        closed = true;
        const diagnostic = classifyDisconnect(update.lastDisconnect?.error);
        if (diagnostic.kind === "logged_out") {
          void flushCredentialWrites()
            .then(() => clearBaileysAuthState(this.authStore))
            .then(() => callbacks.onClose(diagnostic))
            .catch(() => {
              this.logger.error(
                { event: "wa.auth.clear_failed" },
                "Sesi WhatsApp yang logout gagal dibersihkan",
              );
              callbacks.onClose({ kind: "auth_error", reason: "auth_persistence_failed" });
            });
          return;
        }
        void flushCredentialWrites()
          .then(() => callbacks.onClose(diagnostic))
          .catch(() => {
            this.logger.error(
              { event: "wa.auth.flush_failed" },
              "Kredensial WhatsApp gagal diselesaikan saat koneksi ditutup",
            );
            callbacks.onClose({ kind: "auth_error", reason: "auth_persistence_failed" });
          });
      }
    });

    return {
      close: async () => {
        closed = true;
        try {
          await socket.end(undefined);
        } finally {
          await flushCredentialWrites();
        }
      },
    };
  }
}
