export const connectionStates = [
  "disconnected",
  "connecting",
  "qr_ready",
  "connected",
  "logged_out",
  "auth_error",
  "transient_error",
  "stopping",
] as const;

export type ConnectionState = (typeof connectionStates)[number];

export const connectionReasons = [
  "service_started",
  "connect_requested",
  "qr_received",
  "connection_opened",
  "explicit_disconnect",
  "logout_detected",
  "authentication_failed",
  "connection_interrupted",
  "retry_started",
  "retry_exhausted",
  "shutdown_requested",
  "shutdown_complete",
] as const;

export type ConnectionReason = (typeof connectionReasons)[number];

export interface ConnectionSnapshot {
  state: ConnectionState;
  reason: ConnectionReason;
  updatedAt: string;
}

export interface ConnectionStatus extends ConnectionSnapshot {
  phoneNumberMasked?: string;
}

export type DisconnectKind = "logged_out" | "auth_error" | "transient_error";

export type NormalizedDisconnectReason =
  | "logged_out"
  | "bad_session"
  | "connection_replaced"
  | "multidevice_mismatch"
  | "forbidden"
  | "restart_required"
  | "connection_lost"
  | "timed_out"
  | "connection_closed"
  | "server_connection_close"
  | "service_unavailable"
  | "auth_persistence_failed"
  | "unexpected_qr"
  | "unknown_transient";

export interface DisconnectDiagnostic {
  kind: DisconnectKind;
  reason: NormalizedDisconnectReason;
  statusCode?: number;
}

export interface ConnectionCallbacks {
  onQr(qr: string): void;
  onOpen(phoneNumberMasked?: string): void;
  onClose(diagnostic: DisconnectDiagnostic): void;
}

export interface GatewaySocket {
  close(): Promise<void>;
}

export interface GatewayOpenOptions {
  allowQr: boolean;
}

export interface GatewayConnector {
  open(callbacks: ConnectionCallbacks, options: GatewayOpenOptions): Promise<GatewaySocket>;
}

export interface ConnectionIntentStore {
  setAutoReconnect(
    enabled: boolean,
    reason: "active" | "explicit_disconnect" | "logged_out" | "invalid_auth",
  ): Promise<void>;
}

export interface ConnectionLifecycleObserver {
  connected(phoneNumberMasked?: string): void;
  disconnected(): void;
}

export interface GatewayLogger {
  debug(bindings: Record<string, unknown>, message?: string): void;
  info(bindings: Record<string, unknown>, message?: string): void;
  warn(bindings: Record<string, unknown>, message?: string): void;
  error(bindings: Record<string, unknown>, message?: string): void;
}
