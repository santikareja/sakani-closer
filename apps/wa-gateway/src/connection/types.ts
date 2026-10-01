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
  "disconnect_requested",
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

export interface ConnectionCallbacks {
  onQr(qr: string): void;
  onOpen(phoneNumberMasked?: string): void;
  onClose(kind: DisconnectKind): void;
}

export interface GatewaySocket {
  close(): Promise<void>;
}

export interface GatewayConnector {
  open(callbacks: ConnectionCallbacks): Promise<GatewaySocket>;
}

export interface GatewayLogger {
  debug(bindings: Record<string, unknown>, message?: string): void;
  info(bindings: Record<string, unknown>, message?: string): void;
  warn(bindings: Record<string, unknown>, message?: string): void;
  error(bindings: Record<string, unknown>, message?: string): void;
}
