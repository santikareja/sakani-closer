import { ConnectorAuthenticationError } from "./baileys-connector.js";
import type { ConnectionStateMachine } from "./state-machine.js";
import type {
  ConnectionSnapshot,
  DisconnectKind,
  GatewayConnector,
  GatewayLogger,
  GatewaySocket,
} from "./types.js";
import type { QrManager } from "../qr/qr-manager.js";

export function computeReconnectDelay(
  attempt: number,
  baseDelayMs = 1_000,
  maxDelayMs = 30_000,
): number {
  if (!Number.isInteger(attempt) || attempt < 0) throw new RangeError("Retry attempt must be >= 0");
  return Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
}

export class ConnectionManager {
  private socket: GatewaySocket | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private generation = 0;
  private connectPromise: Promise<ConnectionSnapshot> | undefined;

  constructor(
    private readonly connector: GatewayConnector,
    private readonly stateMachine: ConnectionStateMachine,
    private readonly qrManager: QrManager,
    private readonly logger: GatewayLogger,
    private readonly retryBaseDelayMs = 1_000,
    private readonly retryMaxDelayMs = 30_000,
  ) {}

  getStatus(): ConnectionSnapshot {
    return this.stateMachine.getSnapshot();
  }

  connect(): Promise<ConnectionSnapshot> {
    this.clearRetry();
    this.retryAttempt = 0;
    return this.openConnection(false);
  }

  async disconnect(): Promise<ConnectionSnapshot> {
    this.generation += 1;
    this.clearRetry();
    this.retryAttempt = 0;
    this.qrManager.clear();

    const current = this.stateMachine.getSnapshot().state;
    if (current === "disconnected") return this.getStatus();
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

    return this.stateMachine.transition("disconnected", "disconnect_requested");
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
    this.qrManager.clear();
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
    return this.stateMachine.transition("disconnected", "shutdown_complete");
  }

  private openConnection(isRetry: boolean): Promise<ConnectionSnapshot> {
    if (this.connectPromise) return this.connectPromise;

    const state = this.stateMachine.getSnapshot().state;
    if (state === "connecting" || state === "qr_ready" || state === "connected") {
      return Promise.resolve(this.getStatus());
    }

    this.connectPromise = this.performOpen(isRetry).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async performOpen(isRetry: boolean): Promise<ConnectionSnapshot> {
    const generation = ++this.generation;
    this.qrManager.clear();
    this.stateMachine.transition("connecting", isRetry ? "retry_started" : "connect_requested");

    try {
      const socket = await this.connector.open({
        onQr: (qr) => this.onQr(generation, qr),
        onOpen: () => this.onOpen(generation),
        onClose: (kind) => this.onClose(generation, kind),
      });
      if (generation !== this.generation) {
        await socket.close().catch(() => undefined);
        return this.getStatus();
      }
      this.socket = socket;
    } catch (error) {
      if (generation !== this.generation) return this.getStatus();
      if (error instanceof ConnectorAuthenticationError) {
        return this.stateMachine.transition("auth_error", "authentication_failed");
      }
      this.stateMachine.transition("transient_error", "connection_interrupted");
      this.scheduleRetry();
    }

    return this.getStatus();
  }

  private onQr(generation: number, qr: string): void {
    if (generation !== this.generation) return;
    this.qrManager.publish(qr);
    this.stateMachine.transition("qr_ready", "qr_received");
    this.logger.info({ event: "wa.qr.ready" }, "QR WhatsApp siap diambil melalui API internal");
  }

  private onOpen(generation: number): void {
    if (generation !== this.generation) return;
    this.clearRetry();
    this.retryAttempt = 0;
    this.qrManager.clear();
    this.stateMachine.transition("connected", "connection_opened");
    this.logger.info({ event: "wa.connection.open" }, "Koneksi WhatsApp terbuka");
  }

  private onClose(generation: number, kind: DisconnectKind): void {
    if (generation !== this.generation) return;
    this.socket = undefined;
    this.qrManager.clear();

    if (kind === "logged_out") {
      this.stateMachine.transition("logged_out", "logout_detected");
      return;
    }
    if (kind === "auth_error") {
      this.stateMachine.transition("auth_error", "authentication_failed");
      return;
    }

    this.stateMachine.transition("transient_error", "connection_interrupted");
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    const delayMs = computeReconnectDelay(
      this.retryAttempt,
      this.retryBaseDelayMs,
      this.retryMaxDelayMs,
    );
    this.retryAttempt += 1;
    this.logger.warn(
      { event: "wa.connection.retry_scheduled", delayMs, attempt: this.retryAttempt },
      "Koneksi WhatsApp akan dicoba ulang",
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.openConnection(true);
    }, delayMs);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
}
