export const APP_NAME = "Sakani Closer";
export const DEFAULT_TIMEZONE = "Asia/Jakarta";
export const DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID = "default";

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface ServiceStatus {
  status: "ok" | "error";
  latencyMs: number;
}

export interface RequestContext {
  correlationId: string;
  workspaceId?: string;
}

export const inboundMessageTypes = ["text", "image", "document"] as const;
export type InboundMessageType = (typeof inboundMessageTypes)[number];

export const ignoredInboundReasons = [
  "group",
  "broadcast",
  "status",
  "unsupported_jid",
  "unsupported_content",
  "from_me",
  "historical_event",
  "missing_identity",
] as const;
export type IgnoredInboundReason = (typeof ignoredInboundReasons)[number];

export interface WhatsAppAccountBinding {
  workspaceId: string;
  accountId: string;
}

export interface InboundMediaMetadata {
  mimeType: string;
  fileName?: string | undefined;
  fileSize?: number | undefined;
}

export interface AcceptedInboundMessage {
  outcome: "accepted";
  providerMessageId: string;
  providerMessageIdHash: string;
  chatIdentifierHash: string;
  displayName?: string | undefined;
  phoneMasked?: string | undefined;
  direction: "inbound";
  messageType: InboundMessageType;
  text?: string | undefined;
  media?: InboundMediaMetadata | undefined;
  providerTimestamp: string;
  fromMe: false;
}

export interface IgnoredInboundMessage {
  outcome: "ignored";
  providerMessageIdHash?: string | undefined;
  reason: IgnoredInboundReason;
}

export type NormalizedInboundMessage = AcceptedInboundMessage | IgnoredInboundMessage;

export interface WhatsAppInboundEvent {
  version: 1;
  binding: WhatsAppAccountBinding;
  message: NormalizedInboundMessage;
}
