import { randomUUID } from "node:crypto";

import type { BaileysEventMap, WAMessage } from "@whiskeysockets/baileys";
import type { NormalizedInboundMessage } from "@sakani/shared";

import type { GatewayLogger } from "../connection/types.js";
import type { InboundEventSink } from "./event-sink.js";
import { normalizeInboundMessage } from "./normalizer.js";

export type HistoryCapability = "available" | "limited" | "unavailable";

export interface HistoryStatus {
  capability: HistoryCapability;
  progress?: number | undefined;
  isLatest?: boolean | undefined;
  syncType?: string | undefined;
  updatedAt?: string | undefined;
}

type HistoryEvent = BaileysEventMap["messaging-history.set"];

interface PipelineTask {
  source: "realtime" | "history";
  messages: WAMessage[];
  upsertType?: "append" | "notify" | undefined;
  correlationId: string;
}

export class InboundMessagePipeline {
  private pending = Promise.resolve();
  private queuedTasks = 0;
  private historyStatus: HistoryStatus = { capability: "limited" };

  constructor(
    private readonly sink: InboundEventSink,
    private readonly identifierHashKey: string,
    private readonly logger: GatewayLogger,
    private readonly maxQueuedTasks = 8,
    private readonly batchSize = 25,
    private readonly maxHistoryMessagesPerEvent = 5_000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  enqueueRealtime(messages: WAMessage[], upsertType: "append" | "notify"): boolean {
    return this.enqueue({
      source: "realtime",
      messages,
      upsertType,
      correlationId: randomUUID(),
    });
  }

  enqueueHistory(event: HistoryEvent): boolean {
    const correlationId = randomUUID();
    const syncType =
      event.syncType === null || event.syncType === undefined ? undefined : String(event.syncType);
    this.historyStatus = {
      capability: "available",
      ...(typeof event.progress === "number" ? { progress: event.progress } : {}),
      ...(typeof event.isLatest === "boolean" ? { isLatest: event.isLatest } : {}),
      ...(syncType ? { syncType } : {}),
      updatedAt: this.now().toISOString(),
    };
    this.logger.info(
      {
        event: "wa.history.received",
        count: event.messages.length,
        progress: event.progress ?? null,
        isLatest: event.isLatest ?? null,
        syncType: syncType ?? null,
        correlationId,
      },
      "Chunk history WhatsApp diterima",
    );

    if (event.messages.length > this.maxHistoryMessagesPerEvent) {
      this.logger.error(
        {
          event: "wa.history.failed",
          reason: "batch_limit_exceeded",
          correlationId,
          count: event.messages.length,
          limit: this.maxHistoryMessagesPerEvent,
        },
        "Chunk history melebihi batas pemrosesan aman",
      );
    }

    return this.enqueue({
      source: "history",
      messages: event.messages.slice(0, this.maxHistoryMessagesPerEvent),
      correlationId,
    });
  }

  getHistoryStatus(): HistoryStatus {
    return { ...this.historyStatus };
  }

  async flush(): Promise<void> {
    await this.pending;
    await this.sink.flush();
  }

  private enqueue(task: PipelineTask): boolean {
    if (this.queuedTasks >= this.maxQueuedTasks) {
      this.logger.error(
        {
          event: task.source === "history" ? "wa.history.failed" : "wa.message.ingest_failed",
          reason: "backpressure",
          correlationId: task.correlationId,
        },
        "Antrean ingestion WhatsApp penuh",
      );
      return false;
    }
    this.queuedTasks += 1;
    this.pending = this.pending
      .catch(() => undefined)
      .then(() => this.process(task))
      .catch(() => {
        this.logger.error(
          {
            event: task.source === "history" ? "wa.history.failed" : "wa.message.ingest_failed",
            reason: "pipeline_error",
            correlationId: task.correlationId,
          },
          "Pipeline ingestion WhatsApp gagal",
        );
      })
      .finally(() => {
        this.queuedTasks -= 1;
      });
    return true;
  }

  private async process(task: PipelineTask): Promise<void> {
    let acceptedCount = 0;
    let ignoredCount = 0;
    for (let offset = 0; offset < task.messages.length; offset += this.batchSize) {
      const batch = task.messages.slice(offset, offset + this.batchSize);
      const normalized = batch.map((message): NormalizedInboundMessage => {
        try {
          return normalizeInboundMessage(message, {
            identifierHashKey: this.identifierHashKey,
            ...(task.source === "history"
              ? { source: "history" as const }
              : { source: "realtime" as const, upsertType: task.upsertType }),
          });
        } catch {
          return { outcome: "ignored", reason: "missing_identity" };
        }
      });
      acceptedCount += normalized.filter((message) => message.outcome === "accepted").length;
      ignoredCount += normalized.filter((message) => message.outcome === "ignored").length;
      await Promise.all(normalized.map((message) => this.sink.publish(message)));
    }

    if (task.source === "history") {
      this.logger.info(
        {
          event: "wa.history.accepted",
          acceptedCount,
          ignoredCount,
          correlationId: task.correlationId,
        },
        "Chunk history WhatsApp selesai dinormalisasi",
      );
    }
  }
}
