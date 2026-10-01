import type { AcceptedInboundMessage } from "@sakani/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuthStore } from "../auth/store.js";
import type { GatewayLogger } from "../connection/types.js";
import { AccountBindingStore } from "./account-binding.js";
import { HttpInboundEventSink } from "./event-sink.js";

const endpoint = "http://web:3000/api/v1/internal/whatsapp/messages";
const token = "internal-service-token-that-must-never-be-logged";
const binding = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
};
const message: AcceptedInboundMessage = {
  outcome: "accepted",
  providerMessageId: "provider-secret-id",
  providerMessageIdHash: "a".repeat(64),
  chatIdentifierHash: "b".repeat(64),
  displayName: "Kontak Test",
  phoneMasked: "62812****789",
  direction: "inbound",
  messageType: "text",
  text: "isi pesan rahasia",
  providerTimestamp: "2026-10-02T00:00:00.000Z",
  fromMe: false,
};

function memoryStore(): AuthStore {
  const values = new Map<string, unknown>();
  return {
    async read<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async write(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async list(prefix = "") {
      return [...values.keys()].filter((key) => key.startsWith(prefix));
    },
    async flush() {},
  };
}

function logger() {
  const output: string[] = [];
  const write = (bindings: Record<string, unknown>, description?: string) =>
    output.push(JSON.stringify({ bindings, description }));
  return {
    output,
    logger: { debug: write, info: write, warn: write, error: write } satisfies GatewayLogger,
  };
}

async function boundStore(): Promise<AccountBindingStore> {
  const store = new AccountBindingStore(memoryStore());
  await store.set(binding);
  return store;
}

describe("HTTP inbound event sink", () => {
  it("calls the private web URL with the internal token and logs only safe diagnostics", async () => {
    const logs = logger();
    const fetchImplementation = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ status: "accepted" }, { status: 202 }),
    );
    const sink = new HttpInboundEventSink(
      endpoint,
      token,
      await boundStore(),
      logs.logger,
      fetchImplementation as typeof fetch,
    );

    sink.publish(message);
    await sink.flush();

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, request] = fetchImplementation.mock.calls[0]!;
    expect(url).toBe(endpoint);
    expect(request?.headers).toMatchObject({ authorization: `Bearer ${token}` });
    expect(logs.output.join("\n")).toContain("ingest_delivered");
    expect(logs.output.join("\n")).not.toContain(message.text);
    expect(logs.output.join("\n")).not.toContain(message.providerMessageId);
    expect(logs.output.join("\n")).not.toContain(token);
  });

  it("retries transient failures and treats a duplicate response as success", async () => {
    const logs = logger();
    const fetchImplementation = vi
      .fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 409 }));
    const sink = new HttpInboundEventSink(
      endpoint,
      token,
      await boundStore(),
      logs.logger,
      fetchImplementation as typeof fetch,
      3,
    );

    sink.publish(message);
    await sink.flush();

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(logs.output.join("\n")).toContain("duplicate");
    expect(logs.output.join("\n")).not.toContain("ingest_failed");
  });

  it("rejects an unbound event without making a network request", async () => {
    const logs = logger();
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => new Response(),
    );
    const sink = new HttpInboundEventSink(
      endpoint,
      token,
      new AccountBindingStore(memoryStore()),
      logs.logger,
      fetchImplementation as typeof fetch,
    );

    sink.publish(message);
    await sink.flush();

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(logs.output.join("\n")).toContain("account_unbound");
  });
});
