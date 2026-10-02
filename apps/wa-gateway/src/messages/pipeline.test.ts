import type { BaileysEventMap, WAMessage } from "@whiskeysockets/baileys";
import type { NormalizedInboundMessage } from "@sakani/shared";
import { describe, expect, it, vi } from "vitest";

import type { GatewayLogger } from "../connection/types.js";
import type { InboundEventSink } from "./event-sink.js";
import { InboundMessagePipeline } from "./pipeline.js";

function message(id: string, remoteJid = "628123456789@s.whatsapp.net"): WAMessage {
  return {
    key: { id, remoteJid, fromMe: false },
    messageTimestamp: 1_790_812_800,
    message: { conversation: "Pesan history" },
  } as WAMessage;
}

function history(
  messages: WAMessage[],
  overrides: Partial<BaileysEventMap["messaging-history.set"]> = {},
): BaileysEventMap["messaging-history.set"] {
  return { chats: [], contacts: [], messages, progress: 50, isLatest: false, ...overrides };
}

function setup(
  options: { maxQueuedTasks?: number; batchSize?: number; maxMessages?: number } = {},
) {
  const published: NormalizedInboundMessage[] = [];
  const sink: InboundEventSink = {
    publish: vi.fn(async (value) => {
      published.push(value);
    }),
    flush: vi.fn(async () => undefined),
  };
  const output: string[] = [];
  const write = (bindings: Record<string, unknown>, description?: string) =>
    output.push(JSON.stringify({ bindings, description }));
  const logger: GatewayLogger = { debug: write, info: write, warn: write, error: write };
  const pipeline = new InboundMessagePipeline(
    sink,
    "identifier-hash-key-with-at-least-32-characters",
    logger,
    options.maxQueuedTasks ?? 8,
    options.batchSize ?? 2,
    options.maxMessages ?? 5_000,
  );
  return { pipeline, published, output, sink };
}

describe("bounded WhatsApp inbound pipeline", () => {
  it("normalizes direct history and ignores group and status messages", async () => {
    const { pipeline, published, output } = setup();
    pipeline.enqueueHistory(
      history([
        message("direct"),
        message("group", "120363000000000000@g.us"),
        message("status", "status@broadcast"),
      ]),
    );
    await pipeline.flush();

    expect(published[0]).toMatchObject({ outcome: "accepted", messageType: "text" });
    expect(published[1]).toMatchObject({ outcome: "ignored", reason: "group" });
    expect(published[2]).toMatchObject({ outcome: "ignored", reason: "status" });
    expect(output.join("\n")).toContain('"acceptedCount":1');
    expect(output.join("\n")).toContain('"ignoredCount":2');
  });

  it("handles LID with a PN alternate without treating the LID as a phone", async () => {
    const { pipeline, published } = setup();
    const value = message("lid", "123456789012345@lid");
    value.key.remoteJidAlt = "628123456789@s.whatsapp.net";
    pipeline.enqueueHistory(history([value]));
    await pipeline.flush();

    expect(published[0]).toMatchObject({ outcome: "accepted", phoneMasked: "62812****789" });
    expect(JSON.stringify(published[0])).not.toContain("123456789012345@lid");
  });

  it("processes multiple chunks and tracks the latest safe progress", async () => {
    const { pipeline, published } = setup();
    pipeline.enqueueHistory(history([message("one")], { progress: 25 }));
    pipeline.enqueueHistory(history([message("two")], { progress: 100, isLatest: true }));
    await pipeline.flush();

    expect(published).toHaveLength(2);
    expect(pipeline.getHistoryStatus()).toMatchObject({
      capability: "available",
      progress: 100,
      isLatest: true,
    });
  });

  it("bounds oversized history batches and survives malformed entries", async () => {
    const { pipeline, published, output } = setup({ maxMessages: 2 });
    pipeline.enqueueHistory(
      history([message("one"), {} as WAMessage, message("three"), message("four")]),
    );
    await pipeline.flush();

    expect(published).toHaveLength(2);
    expect(published[1]).toMatchObject({ outcome: "ignored", reason: "missing_identity" });
    expect(output.join("\n")).toContain("batch_limit_exceeded");
  });

  it("routes realtime and history messages through the same normalizer", async () => {
    const { pipeline, published } = setup();
    pipeline.enqueueRealtime([message("same")], "notify");
    pipeline.enqueueHistory(history([message("same")]));
    await pipeline.flush();

    expect(published).toHaveLength(2);
    expect(published[0]).toEqual(published[1]);
  });
});
