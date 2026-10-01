import { createHmac } from "node:crypto";

import {
  isJidBroadcast,
  isJidGroup,
  isJidStatusBroadcast,
  isLidUser,
  isPnUser,
  jidDecode,
  normalizeMessageContent,
  type WAMessage,
} from "@whiskeysockets/baileys";
import type {
  IgnoredInboundReason,
  InboundMediaMetadata,
  NormalizedInboundMessage,
} from "@sakani/shared";

const MAX_TEXT_LENGTH = 65_535;
const MAX_NAME_LENGTH = 255;

function safeString(value: string | null | undefined, maxLength: number): string | undefined {
  const normalized = value
    ? [...value]
        .map((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code < 32 || code === 127 ? " " : character;
        })
        .join("")
        .trim()
    : undefined;
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : undefined;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const toNumber = value.toNumber;
    if (typeof toNumber === "function") {
      try {
        return safeNumber(toNumber.call(value));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function providerTimestamp(value: unknown): string | undefined {
  const seconds = safeNumber(value);
  if (seconds === undefined) return undefined;
  const date = new Date(seconds * 1_000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function hashOpaqueIdentifier(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function maskPhoneFromJid(jid: string | undefined): string | undefined {
  if (!jid || !isPnUser(jid)) return undefined;
  const digits = jidDecode(jid)?.user.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return undefined;
  return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
}

function ignored(
  reason: IgnoredInboundReason,
  providerMessageIdHash?: string,
): NormalizedInboundMessage {
  return {
    outcome: "ignored",
    reason,
    ...(providerMessageIdHash ? { providerMessageIdHash } : {}),
  };
}

function classifyJid(jid: string | undefined): IgnoredInboundReason | undefined {
  if (!jid) return "unsupported_jid";
  if (isJidStatusBroadcast(jid)) return "status";
  if (isJidGroup(jid)) return "group";
  if (isJidBroadcast(jid)) return "broadcast";
  if (!isPnUser(jid) && !isLidUser(jid)) return "unsupported_jid";
  return undefined;
}

function mediaMetadata(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  fileLength: unknown,
): InboundMediaMetadata | undefined {
  const safeMimeType = safeString(mimeType, MAX_NAME_LENGTH);
  if (!safeMimeType) return undefined;
  const safeFileName = safeString(fileName, MAX_NAME_LENGTH);
  const fileSize = safeNumber(fileLength);
  return {
    mimeType: safeMimeType,
    ...(safeFileName ? { fileName: safeFileName } : {}),
    ...(fileSize === undefined ? {} : { fileSize }),
  };
}

export interface NormalizeMessageOptions {
  upsertType: "append" | "notify";
  identifierHashKey: string;
}

export function normalizeInboundMessage(
  message: WAMessage,
  options: NormalizeMessageOptions,
): NormalizedInboundMessage {
  const providerMessageId = safeString(message.key.id, 256);
  const providerMessageIdHash = providerMessageId
    ? hashOpaqueIdentifier(providerMessageId, options.identifierHashKey)
    : undefined;

  if (options.upsertType !== "notify") {
    return ignored("historical_event", providerMessageIdHash);
  }

  const jidReason = classifyJid(message.key.remoteJid ?? undefined);
  if (jidReason) return ignored(jidReason, providerMessageIdHash);
  if (message.key.fromMe) return ignored("from_me", providerMessageIdHash);

  const timestamp = providerTimestamp(message.messageTimestamp);
  const remoteJid = message.key.remoteJid;
  if (!providerMessageId || !timestamp || !remoteJid) {
    return ignored("missing_identity", providerMessageIdHash);
  }

  const content = normalizeMessageContent(message.message);
  if (!content) return ignored("unsupported_content", providerMessageIdHash);

  let messageType: "text" | "image" | "document";
  let text: string | undefined;
  let media: InboundMediaMetadata | undefined;

  if (typeof content.conversation === "string") {
    messageType = "text";
    text = safeString(content.conversation, MAX_TEXT_LENGTH);
  } else if (content.extendedTextMessage) {
    messageType = "text";
    text = safeString(content.extendedTextMessage.text, MAX_TEXT_LENGTH);
  } else if (content.imageMessage) {
    messageType = "image";
    text = safeString(content.imageMessage.caption, MAX_TEXT_LENGTH);
    media = mediaMetadata(
      content.imageMessage.mimetype,
      undefined,
      content.imageMessage.fileLength,
    );
  } else if (content.documentMessage) {
    messageType = "document";
    text = safeString(content.documentMessage.caption, MAX_TEXT_LENGTH);
    media = mediaMetadata(
      content.documentMessage.mimetype,
      content.documentMessage.fileName,
      content.documentMessage.fileLength,
    );
  } else {
    return ignored("unsupported_content", providerMessageIdHash);
  }

  const phoneJid = isPnUser(remoteJid)
    ? remoteJid
    : isPnUser(message.key.remoteJidAlt ?? undefined)
      ? message.key.remoteJidAlt
      : undefined;
  const contactIdentifier = phoneJid ?? remoteJid;
  const displayName = safeString(message.pushName, 120);
  const phoneMasked = maskPhoneFromJid(phoneJid);

  return {
    outcome: "accepted",
    providerMessageId,
    providerMessageIdHash: hashOpaqueIdentifier(providerMessageId, options.identifierHashKey),
    chatIdentifierHash: hashOpaqueIdentifier(contactIdentifier, options.identifierHashKey),
    ...(displayName ? { displayName } : {}),
    ...(phoneMasked ? { phoneMasked } : {}),
    direction: "inbound",
    messageType,
    ...(text ? { text } : {}),
    ...(media ? { media } : {}),
    providerTimestamp: timestamp,
    fromMe: false,
  };
}
