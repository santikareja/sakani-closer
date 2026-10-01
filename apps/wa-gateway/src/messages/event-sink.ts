import type { NormalizedInboundMessage, WhatsAppInboundEvent } from "@sakani/shared";

import type { GatewayLogger } from "../connection/types.js";
import type { AccountBindingStore } from "./account-binding.js";

export interface InboundEventSink {
  publish(message: NormalizedInboundMessage): void;
  flush(): Promise<void>;
}

export class HttpInboundEventSink implements InboundEventSink {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly endpoint: string,
    private readonly internalServiceToken: string,
    private readonly bindings: AccountBindingStore,
    private readonly logger: GatewayLogger,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly maxAttempts = 3,
  ) {}

  publish(message: NormalizedInboundMessage): void {
    const binding = this.bindings.get();
    if (!binding) {
      this.logger.warn(
        {
          event: "wa.message.ingest_skipped",
          reason: "account_unbound",
          outcome: message.outcome,
          providerMessageIdHash: message.providerMessageIdHash,
        },
        "Event WhatsApp belum dapat disimpan karena akun belum terikat ke workspace",
      );
      return;
    }

    const payload: WhatsAppInboundEvent = { version: 1, binding, message };
    const task = this.deliver(payload).finally(() => this.pending.delete(task));
    this.pending.add(task);
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  private async deliver(payload: WhatsAppInboundEvent): Promise<void> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.internalServiceToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5_000),
        });
        if (response.ok || response.status === 409) {
          let ingestStatus: "accepted" | "duplicate" | "ignored" =
            response.status === 409
              ? "duplicate"
              : payload.message.outcome === "ignored"
                ? "ignored"
                : "accepted";
          try {
            const responseBody = (await response.json()) as { status?: unknown };
            if (
              responseBody.status === "accepted" ||
              responseBody.status === "duplicate" ||
              responseBody.status === "ignored"
            ) {
              ingestStatus = responseBody.status;
            }
          } catch {
            // The response body is optional and never included in logs.
          }
          this.logger.info(
            {
              event: "wa.message.ingest_delivered",
              ingestStatus,
              httpStatus: response.status,
              providerMessageIdHash: payload.message.providerMessageIdHash,
            },
            "Event WhatsApp diterima penyimpanan internal",
          );
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          this.logger.warn(
            {
              event: "wa.message.ingest_rejected",
              ingestStatus: "rejected",
              httpStatus: response.status,
              providerMessageIdHash: payload.message.providerMessageIdHash,
            },
            "Event WhatsApp ditolak penyimpanan internal",
          );
          return;
        }
      } catch {
        // Retry below without logging response bodies or raw message content.
      }
      if (attempt < this.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }

    this.logger.error(
      {
        event: "wa.message.ingest_failed",
        ingestStatus: "rejected",
        outcome: payload.message.outcome,
        providerMessageIdHash: payload.message.providerMessageIdHash,
      },
      "Event WhatsApp gagal dikirim ke penyimpanan internal",
    );
  }
}
