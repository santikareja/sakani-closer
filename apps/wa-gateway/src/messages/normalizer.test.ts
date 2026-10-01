import type { WAMessage } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";

import { maskPhoneFromJid, normalizeInboundMessage } from "./normalizer.js";

const hashKey = "test-internal-token-with-at-least-32-characters";

function message(overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: {
      id: "provider-message-1",
      remoteJid: "628123456789@s.whatsapp.net",
      fromMe: false,
    },
    messageTimestamp: 1_790_812_800,
    pushName: "Calon Pembeli",
    message: { conversation: "Apakah unit masih tersedia?" },
    ...overrides,
  } as WAMessage;
}

function normalize(value: WAMessage, upsertType: "append" | "notify" = "notify") {
  return normalizeInboundMessage(value, { identifierHashKey: hashKey, upsertType });
}

describe("WhatsApp inbound normalizer", () => {
  it("normalizes a direct text message without exposing the JID", () => {
    const result = normalize(message());

    expect(result).toMatchObject({
      outcome: "accepted",
      direction: "inbound",
      messageType: "text",
      text: "Apakah unit masih tersedia?",
      phoneMasked: "62812****789",
      fromMe: false,
    });
    expect(JSON.stringify(result)).not.toContain("628123456789@s.whatsapp.net");
  });

  it("normalizes extended text", () => {
    const result = normalize(
      message({ message: { extendedTextMessage: { text: "Saya ingin jadwal survei." } } }),
    );
    expect(result).toMatchObject({
      outcome: "accepted",
      messageType: "text",
      text: "Saya ingin jadwal survei.",
    });
  });

  it("normalizes image metadata without downloading media", () => {
    const result = normalize(
      message({
        message: {
          imageMessage: {
            mimetype: "image/jpeg",
            fileLength: 2048,
            caption: "Tampak depan",
          },
        },
      }),
    );
    expect(result).toMatchObject({
      outcome: "accepted",
      messageType: "image",
      text: "Tampak depan",
      media: { mimeType: "image/jpeg", fileSize: 2048 },
    });
  });

  it("normalizes document metadata without a storage payload", () => {
    const result = normalize(
      message({
        message: {
          documentMessage: {
            mimetype: "application/pdf",
            fileName: "brosur.pdf",
            fileLength: 4096,
          },
        },
      }),
    );
    expect(result).toMatchObject({
      outcome: "accepted",
      messageType: "document",
      media: {
        mimeType: "application/pdf",
        fileName: "brosur.pdf",
        fileSize: 4096,
      },
    });
    expect(JSON.stringify(result)).not.toContain("url");
  });

  it.each([
    ["group", "120363000000000000@g.us"],
    ["broadcast", "12345@broadcast"],
    ["status", "status@broadcast"],
    ["unsupported_jid", "12345@newsletter"],
  ] as const)("ignores %s JIDs", (reason, remoteJid) => {
    expect(normalize(message({ key: { id: "ignored", remoteJid, fromMe: false } }))).toMatchObject({
      outcome: "ignored",
      reason,
    });
  });

  it("ignores owner-originated messages in receive-only mode", () => {
    expect(
      normalize(
        message({
          key: {
            id: "owner-message",
            remoteJid: "628123456789@s.whatsapp.net",
            fromMe: true,
          },
        }),
      ),
    ).toMatchObject({ outcome: "ignored", reason: "from_me" });
  });

  it("ignores historical append events", () => {
    expect(normalize(message(), "append")).toMatchObject({
      outcome: "ignored",
      reason: "historical_event",
    });
  });

  it("masks phone JIDs and never derives a phone from LID", () => {
    expect(maskPhoneFromJid("628123456789@s.whatsapp.net")).toBe("62812****789");
    expect(maskPhoneFromJid("123456789012345@lid")).toBeUndefined();
  });
});
