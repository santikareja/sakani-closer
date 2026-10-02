import { z } from "zod";

export const whatsappLifecycleEventSchema = z
  .object({
    version: z.literal(1),
    binding: z
      .object({
        workspaceId: z.string().uuid(),
        accountId: z.string().uuid(),
      })
      .strict(),
    correlationId: z.string().uuid(),
    state: z.enum(["connected", "disconnected"]),
    occurredAt: z.string().datetime(),
    phoneNumberMasked: z
      .string()
      .regex(/^\d{5}\*{4}\d{3}$/)
      .optional(),
  })
  .strict();

export type ValidatedWhatsAppLifecycleEvent = z.infer<typeof whatsappLifecycleEventSchema>;
