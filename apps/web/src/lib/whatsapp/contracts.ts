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

export const historyStatusSchema = z
  .object({
    capability: z.enum(["available", "limited", "unavailable"]),
    progress: z.number().min(0).max(100).optional(),
    isLatest: z.boolean().optional(),
    syncType: z.string().max(64).optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export const whatsappStatusResponseSchema = z.object({
  connection: z.object({
    state: z.enum(["connected", "connecting", "disconnected", "unknown"]),
    detail: connectionStateSchema.optional(),
    updatedAt: z.string().datetime().optional(),
  }),
  binding: z.object({ state: z.enum(["bound", "unbound", "unknown"]) }).strict(),
  account: z.object({
    status: z.enum(["connected", "connecting", "disconnected", "unknown"]),
    gatewayAccountId: z.literal("default").optional(),
    lastConnectedAt: z.string().datetime().nullable(),
    lastDisconnectedAt: z.string().datetime().nullable(),
    phoneNumberMasked: z
      .string()
      .regex(/^\d{5}\*{4}\d{3}$/)
      .nullable(),
    updatedAt: z.string().datetime().nullable(),
  }),
  history: historyStatusSchema,
  diagnostics: z.object({
    gateway: z.enum(["healthy", "unavailable"]),
    lifecyclePersistence: z.enum(["unknown", "ok", "failed"]),
  }),
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

export type WhatsAppStatusResponse = z.infer<typeof whatsappStatusResponseSchema>;
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
