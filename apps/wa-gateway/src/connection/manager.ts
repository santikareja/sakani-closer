import { ConnectorAuthenticationError } from "./baileys-connector.js";
import type { ConnectionStateMachine } from "./state-machine.js";
import type { AuthStateClassification } from "../auth/baileys-auth-state.js";
import type {
  ConnectionSnapshot,
  ConnectionStatus,
  ConnectionIntentStore,
  DisconnectDiagnostic,
  GatewayConnector,
  GatewayLogger,
  GatewaySocket,
} from "./types.js";
import type { QrManager } from "../qr/qr-manager.js";

export const DEFAULT_RETRY_BASE_DELAY_MS = 1_000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;
export const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
export const DEFAULT_STABLE_CONNECTION_MS = 60_000;

export function computeReconnectDelay(
  attempt: number,
  baseDelayMs = 1_000,
  maxDelayMs = 30_000,
  random: () => number = Math.random,
  jitterRatio = 0.2,
): number {
  if (!Number.isInteger(attempt) || attempt < 0) throw new RangeError("Retry attempt must be >= 0");
  if (jitterRatio < 0 || jitterRatio > 1)
    throw new RangeError("Jitter ratio must be between 0 and 1");
  const randomValue = Math.min(1, Math.max(0, random()));
  const jitterFactor = 1 - jitterRatio + randomValue * jitterRatio * 2;
  return Math.max(1, Math.min(maxDelayMs, Math.round(baseDelayMs * 2 ** attempt * jitterFactor)));
}

export class ConnectionManager {
  private socket: GatewaySocket | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stableConnectionTimer: ReturnType<typeof setTimeout> | undefined;
  private retryDelayMs: number | undefined;
  private retryAttempt = 0;
  private generation = 0;
  private connectPromise: Promise<ConnectionSnapshot> | undefined;
  private phoneNumberMasked: string | undefined;
  private allowQrForCurrentLifecycle = true;
  private authStateClassification: AuthStateClassification = "missing";
  private intentWrite = Promise.resolve();

  constructor(
    private readonly connector: GatewayConnector,
    private readonly stateMachine: ConnectionStateMachine,
    private readonly qrManager: QrManager,
    private readonly logger: GatewayLogger,
    private readonly retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    private readonly retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
    private readonly maxRetryAttempts = DEFAULT_MAX_RETRY_ATTEMPTS,
    private readonly connectionIntentStore?: ConnectionIntentStore,
    private readonly random: () => number = Math.random,
    private readonly stableConnectionMs = DEFAULT_STABLE_CONNECTION_MS,
  ) {
    if (!Number.isInteger(maxRetryAttempts) || maxRetryAttempts < 0 || maxRetryAttempts > 20) {
      throw new RangeError("Max retry attempts must be between 0 and 20");
    }
  }

  getStatus(): ConnectionStatus {
    const snapshot = this.stateMachine.getSnapshot();
    return snapshot.state === "connected" && this.phoneNumberMasked
      ? { ...snapshot, phoneNumberMasked: this.phoneNumberMasked }
      : snapshot;
  }

  setAuthStateClassification(classification: AuthStateClassification): void {
    this.authStateClassification = classification;
  }

  connect(): Promise<ConnectionSnapshot> {
    const state = this.stateMachine.getSnapshot().state;
    if (
      this.connectPromise ||
      state === "connecting" ||
      state === "qr_ready" ||
      state === "connected"
    ) {
      return this.openConnection("manual");
    }
    this.clearRetry();
    this.clearStableConnectionTimer();
    this.retryAttempt = 0;
    this.allowQrForCurrentLifecycle = true;
    return this.connectManually(this.generation);
  }

  reconnectAtStartup(): Promise<ConnectionSnapshot> {
    const state = this.stateMachine.getSnapshot().state;
    if (this.connectPromise || state !== "disconnected") return Promise.resolve(this.getStatus());
    this.clearRetry();
    this.clearStableConnectionTimer();
    this.retryAttempt = 0;
    this.allowQrForCurrentLifecycle = false;
    return this.openConnection("startup");
  }

  authenticationFailedAtStartup(): ConnectionSnapshot {
    this.authStateClassification = "corrupt";
    if (this.stateMachine.getSnapshot().state !== "disconnected") return this.getStatus();
    return this.stateMachine.transition("auth_error", "authentication_failed");
  }

  async disconnect(): Promise<ConnectionSnapshot> {
    this.generation += 1;
    this.clearRetry();
    this.clearStableConnectionTimer();
    this.retryAttempt = 0;
    this.qrManager.clear();
    this.phoneNumberMasked = undefined;
    await this.persistAutoReconnectIntent(false, "explicit_disconnect");

    const current = this.stateMachine.getSnapshot().state;
    if (current === "disconnected") {
      return this.stateMachine.transition("disconnected", "explicit_disconnect");
    }
    if (current === "stopping") return this.getStatus();

    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      try {
        await socket.close();
      } catch {
        this.logger.warn({ event: "wa.socket.close_failed" }, "Socket WhatsApp gagal ditutup rapi");
      }
    }

    return this.stateMachine.transition("disconnected", "explicit_disconnect");
  }

  async stop(): Promise<ConnectionSnapshot> {
    const current = this.stateMachine.getSnapshot().state;
    if (current === "disconnected") {
      this.stateMachine.transition("stopping", "shutdown_requested");
    } else if (current !== "stopping") {
      this.stateMachine.transition("stopping", "shutdown_requested");
    }

    this.generation += 1;
    this.clearRetry();
    this.clearStableConnectionTimer();
    this.qrManager.clear();
    this.phoneNumberMasked = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      try {
        await socket.close();
      } catch {
        this.logger.warn(
          { event: "wa.socket.stop_failed" },
          "Socket WhatsApp gagal dihentikan rapi",
        );
      }
    }
    await this.intentWrite;
    return this.stateMachine.transition("disconnected", "shutdown_complete");
  }

  private async connectManually(requestGeneration: number): Promise<ConnectionSnapshot> {
    await this.persistAutoReconnectIntent(true, "active");
    if (requestGeneration !== this.generation) return this.getStatus();
    return this.openConnection("manual");
  }

  private openConnection(mode: "manual" | "startup" | "retry"): Promise<ConnectionSnapshot> {
    if (this.connectPromise) return this.connectPromise;

    const state = this.stateMachine.getSnapshot().state;
    if (state === "connecting" || state === "qr_ready" || state === "connected") {
      return Promise.resolve(this.getStatus());
    }

    this.connectPromise = this.performOpen(mode).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async performOpen(mode: "manual" | "startup" | "retry"): Promise<ConnectionSnapshot> {
    const generation = ++this.generation;
    this.qrManager.clear();
    this.phoneNumberMasked = undefined;
    const reason =
      mode === "retry"
        ? "retry_started"
        : mode === "startup"
          ? "service_started"
          : "connect_requested";
    this.stateMachine.transition("connecting", reason);
    const allowQr = this.allowQrForCurrentLifecycle;

    try {
      const socket = await this.connector.open(
        {
          onQr: (qr) => (allowQr ? this.onQr(generation, qr) : this.onUnexpectedQr(generation)),
          onOpen: (phoneNumberMasked) => this.onOpen(generation, phoneNumberMasked),
          onClose: (diagnostic) => this.onClose(generation, diagnostic),
        },
        { allowQr },
      );
      const stateAfterOpen = this.stateMachine.getSnapshot().state;
      if (
        generation !== this.generation ||
        stateAfterOpen === "transient_error" ||
        stateAfterOpen === "logged_out" ||
        stateAfterOpen === "auth_error" ||
        stateAfterOpen === "stopping" ||
        stateAfterOpen === "disconnected"
      ) {
        await socket.close().catch(() => undefined);
        return this.getStatus();
      }
      this.socket = socket;
    } catch (error) {
      if (generation !== this.generation) return this.getStatus();
      if (error instanceof ConnectorAuthenticationError) {
        this.authStateClassification = "corrupt";
        await this.persistAutoReconnectIntent(false, "invalid_auth");
        return this.stateMachine.transition("auth_error", "authentication_failed");
      }
      this.stateMachine.transition("transient_error", "connection_interrupted");
      const retry = this.scheduleRetry();
      this.logClose(
        { kind: "transient_error", reason: "unknown_transient" },
        retry.scheduled,
        retry.retryCount,
        retry.nextRetryDelayMs,
      );
    }

    return this.getStatus();
  }

  private onQr(generation: number, qr: string): void {
    if (generation !== this.generation) return;
    this.qrManager.publish(qr);
    this.stateMachine.transition("qr_ready", "qr_received");
    this.logger.info({ event: "wa.qr.ready" }, "QR WhatsApp siap diambil melalui API internal");
  }

  private onUnexpectedQr(generation: number): void {
    if (generation !== this.generation) return;
    this.generation += 1;
    this.authStateClassification = "logged_out";
    this.qrManager.clear();
    const socket = this.socket;
    this.socket = undefined;
    if (socket) void socket.close().catch(() => undefined);
    void this.persistAutoReconnectIntent(false, "invalid_auth");
    this.stateMachine.transition("auth_error", "authentication_failed");
    this.logger.warn(
      { event: "wa.auth.unexpected_qr" },
      "Session tersimpan meminta QR baru dan tidak akan dicoba ulang otomatis",
    );
  }

  private onOpen(generation: number, phoneNumberMasked?: string): void {
    if (generation !== this.generation) return;
    this.clearRetry();
    this.clearStableConnectionTimer();
    if (this.retryAttempt > 0) {
      this.stableConnectionTimer = setTimeout(() => {
        this.stableConnectionTimer = undefined;
        this.retryAttempt = 0;
      }, this.stableConnectionMs);
    }
    this.qrManager.clear();
    this.phoneNumberMasked = phoneNumberMasked;
    this.authStateClassification = "registered";
    this.stateMachine.transition("connected", "connection_opened");
    this.logger.info(
      { event: "wa.connection.open", authStateClassification: "registered" },
      "Koneksi WhatsApp terbuka",
    );
  }

  private onClose(generation: number, diagnostic: DisconnectDiagnostic): void {
    if (generation !== this.generation) return;
    this.socket = undefined;
    this.clearStableConnectionTimer();
    this.qrManager.clear();
    this.phoneNumberMasked = undefined;

    if (diagnostic.kind === "logged_out") {
      this.authStateClassification = "logged_out";
      void this.persistAutoReconnectIntent(false, "logged_out");
      this.stateMachine.transition("logged_out", "logout_detected");
      this.logClose(diagnostic, false, this.retryAttempt);
      return;
    }
    if (diagnostic.kind === "auth_error") {
      this.authStateClassification = "logged_out";
      void this.persistAutoReconnectIntent(false, "invalid_auth");
      this.stateMachine.transition("auth_error", "authentication_failed");
      this.logClose(diagnostic, false, this.retryAttempt);
      return;
    }

    this.stateMachine.transition("transient_error", "connection_interrupted");
    const retry = this.scheduleRetry();
    this.logClose(diagnostic, retry.scheduled, retry.retryCount, retry.nextRetryDelayMs);
  }

  private scheduleRetry(): {
    scheduled: boolean;
    retryCount: number;
    nextRetryDelayMs?: number;
  } {
    if (this.retryTimer) {
      return {
        scheduled: true,
        retryCount: this.retryAttempt,
        ...(this.retryDelayMs === undefined ? {} : { nextRetryDelayMs: this.retryDelayMs }),
      };
    }
    if (this.retryAttempt >= this.maxRetryAttempts) {
      this.stateMachine.transition("transient_error", "retry_exhausted");
      this.logger.error(
        { event: "wa.connection.retry_exhausted", attempts: this.retryAttempt },
        "Batas percobaan ulang koneksi WhatsApp tercapai",
      );
      return { scheduled: false, retryCount: this.retryAttempt };
    }
    const delayMs = computeReconnectDelay(
      this.retryAttempt,
      this.retryBaseDelayMs,
      this.retryMaxDelayMs,
      this.random,
    );
    this.retryAttempt += 1;
    this.logger.warn(
      { event: "wa.connection.retry_scheduled", delayMs, attempt: this.retryAttempt },
      "Koneksi WhatsApp akan dicoba ulang",
    );
    this.retryDelayMs = delayMs;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.retryDelayMs = undefined;
      void this.openConnection("retry");
    }, delayMs);
    return { scheduled: true, retryCount: this.retryAttempt, nextRetryDelayMs: delayMs };
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retryDelayMs = undefined;
  }

  private clearStableConnectionTimer(): void {
    if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);
    this.stableConnectionTimer = undefined;
  }

  private logClose(
    diagnostic: DisconnectDiagnostic,
    shouldReconnect: boolean,
    retryCount: number,
    nextRetryDelayMs?: number,
  ): void {
    this.logger.warn(
      {
        event: "wa.connection.closed",
        authStateClassification: this.authStateClassification,
        normalizedReason: diagnostic.reason,
        statusCode: diagnostic.statusCode ?? null,
        shouldReconnect,
        retryCount,
        nextRetryDelayMs: nextRetryDelayMs ?? null,
      },
      "Koneksi WhatsApp ditutup",
    );
  }

  private persistAutoReconnectIntent(
    enabled: boolean,
    reason: "active" | "explicit_disconnect" | "logged_out" | "invalid_auth",
  ): Promise<void> {
    if (!this.connectionIntentStore) return Promise.resolve();
    const write = this.intentWrite
      .catch(() => undefined)
      .then(() => this.connectionIntentStore!.setAutoReconnect(enabled, reason));
    this.intentWrite = write.catch(() => {
      this.logger.error(
        { event: "wa.connection.intent_persist_failed" },
        "Kebijakan reconnect WhatsApp gagal disimpan",
      );
    });
    return this.intentWrite;
  }
}
