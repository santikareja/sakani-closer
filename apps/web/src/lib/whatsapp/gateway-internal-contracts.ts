import "server-only";

import { z } from "zod";

import { connectionStateSchema, historyStatusSchema } from "./contracts";

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
  binding: z.discriminatedUnion("state", [
    z.object({ state: z.literal("unbound") }).strict(),
    z
      .object({
        state: z.literal("bound"),
        workspaceId: z.string().uuid(),
        accountId: z.string().uuid(),
      })
      .strict(),
  ]),
  lifecyclePersistence: z
    .object({
      state: z.enum(["unknown", "ok", "failed"]),
      updatedAt: z.string().datetime().optional(),
      correlationId: z.string().uuid().optional(),
    })
    .strict(),
  history: historyStatusSchema,
});

export type GatewayStatusResponse = z.infer<typeof gatewayStatusResponseSchema>;
