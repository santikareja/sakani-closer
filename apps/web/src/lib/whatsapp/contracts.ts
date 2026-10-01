import { z } from "zod";

export const connectionStateSchema = z.enum([
  "disconnected",
  "connecting",
  "qr_ready",
  "connected",
  "logged_out",
  "auth_error",
  "transient_error",
  "stopping",
]);

export const connectionReasonSchema = z.enum([
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
]);

export const connectionStatusSchema = z.object({
  state: connectionStateSchema,
  reason: connectionReasonSchema,
  updatedAt: z.string().datetime(),
  phoneNumberMasked: z
    .string()
    .regex(/^\d{5}\*{4}\d{3}$/)
    .optional(),
});

export const gatewayStatusResponseSchema = z.object({
  connection: connectionStatusSchema,
  binding: z.object({ state: z.enum(["bound", "unbound"]) }),
});

export const gatewayQrResponseSchema = z.object({
  qr: z.string().min(1).max(8_192),
  expiresAt: z.string().datetime(),
});

export const gatewayErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(256),
  }),
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type GatewayStatusResponse = z.infer<typeof gatewayStatusResponseSchema>;
export type GatewayQrResponse = z.infer<typeof gatewayQrResponseSchema>;

export class GatewayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super("Private WhatsApp gateway request failed");
    this.name = "GatewayRequestError";
  }
}
