import { randomUUID } from "node:crypto";

import type { WhatsAppAccountLifecycleEvent } from "@sakani/shared";

import type { GatewayLogger } from "../connection/types.js";
import type { AccountBindingStore } from "../messages/account-binding.js";

export type LifecyclePersistenceState = "unknown" | "ok" | "failed";

export interface LifecyclePersistenceStatus {
  state: LifecyclePersistenceState;
  updatedAt?: string | undefined;
  correlationId?: string | undefined;
}

export interface AccountLifecycleSink {
  connected(phoneNumberMasked?: string): void;
  disconnected(): void;
  getStatus(): LifecyclePersistenceStatus;
  flush(): Promise<void>;
}

export class HttpAccountLifecycleSink implements AccountLifecycleSink {
  private pending = Promise.resolve();
  private status: LifecyclePersistenceStatus = { state: "unknown" };

  constructor(
    private readonly endpoint: string,
    private readonly internalServiceToken: string,
    private readonly bindings: AccountBindingStore,
    private readonly logger: GatewayLogger,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly maxAttempts = 3,
    private readonly now: () => Date = () => new Date(),
  ) {}

  connected(phoneNumberMasked?: string): void {
    this.enqueue("connected", phoneNumberMasked);
  }

  disconnected(): void {
    this.enqueue("disconnected");
  }

  getStatus(): LifecyclePersistenceStatus {
    return { ...this.status };
  }

  async flush(): Promise<void> {
    await this.pending;
  }

  private enqueue(state: "connected" | "disconnected", phoneNumberMasked?: string): void {
    const binding = this.bindings.get();
    if (!binding) {
      this.logger.warn(
        { event: "wa.account.lifecycle.persistence_failed", reason: "account_unbound" },
        "Lifecycle akun WhatsApp belum dapat disimpan karena binding belum tersedia",
      );
      return;
    }

    const correlationId = randomUUID();
    const payload: WhatsAppAccountLifecycleEvent = {
      version: 1,
      binding,
      correlationId,
      state,
      occurredAt: this.now().toISOString(),
      ...(state === "connected" && phoneNumberMasked ? { phoneNumberMasked } : {}),
    };
    this.pending = this.pending.catch(() => undefined).then(() => this.deliver(payload));
  }

  private async deliver(payload: WhatsAppAccountLifecycleEvent): Promise<void> {
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
        if (response.ok) {
          this.status = {
            state: "ok",
            updatedAt: payload.occurredAt,
            correlationId: payload.correlationId,
          };
          this.logger.info(
            {
              event: `wa.account.lifecycle.${payload.state}`,
              correlationId: payload.correlationId,
              httpStatus: response.status,
            },
            "Lifecycle akun WhatsApp tersimpan",
          );
          return;
        }
        if (response.status >= 400 && response.status < 500) break;
      } catch {
        // Retry transient network failures without exposing request details.
      }
      if (attempt < this.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }

    this.status = {
      state: "failed",
      updatedAt: this.now().toISOString(),
      correlationId: payload.correlationId,
    };
    this.logger.error(
      {
        event: "wa.account.lifecycle.persistence_failed",
        correlationId: payload.correlationId,
        lifecycleState: payload.state,
      },
      "Lifecycle akun WhatsApp gagal disimpan",
    );
  }
}
