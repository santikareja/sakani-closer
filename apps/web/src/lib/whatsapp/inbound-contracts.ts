import { ignoredInboundReasons, inboundMessageTypes } from "@sakani/shared";
import { z } from "zod";

const bindingSchema = z
  .object({
    workspaceId: z.string().uuid(),
    accountId: z.string().uuid(),
  })
  .strict();

const mediaSchema = z
  .object({
    mimeType: z.string().trim().min(1).max(255),
    fileName: z.string().trim().min(1).max(255).optional(),
    fileSize: z.number().int().nonnegative().safe().optional(),
  })
  .strict();

const acceptedMessageSchema = z
  .object({
    outcome: z.literal("accepted"),
    providerMessageId: z.string().trim().min(1).max(256),
    providerMessageIdHash: z.string().regex(/^[a-f0-9]{64}$/),
    chatIdentifierHash: z.string().regex(/^[a-f0-9]{64}$/),
    displayName: z.string().trim().min(1).max(120).optional(),
    phoneMasked: z
      .string()
      .regex(/^\d{5}\*{4}\d{3}$/)
      .optional(),
    direction: z.literal("inbound"),
    messageType: z.enum(inboundMessageTypes),
    text: z.string().min(1).max(65_535).optional(),
    media: mediaSchema.optional(),
    providerTimestamp: z.string().datetime(),
    fromMe: z.literal(false),
  })
  .strict();

const ignoredMessageSchema = z
  .object({
    outcome: z.literal("ignored"),
    providerMessageIdHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    reason: z.enum(ignoredInboundReasons),
  })
  .strict();

export const whatsappInboundEventSchema = z
  .object({
    version: z.literal(1),
    binding: bindingSchema,
    message: z.discriminatedUnion("outcome", [acceptedMessageSchema, ignoredMessageSchema]),
  })
  .strict();

export type ValidatedWhatsAppInboundEvent = z.infer<typeof whatsappInboundEventSchema>;
