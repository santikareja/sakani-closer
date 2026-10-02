import { describe, expect, it, vi } from "vitest";

import type { AuthStore } from "../auth/store.js";
import type { GatewayLogger } from "../connection/types.js";
import { AccountBindingStore } from "../messages/account-binding.js";
import { HttpAccountLifecycleSink } from "./event-sink.js";

const endpoint = "http://web:3000/api/v1/internal/whatsapp/lifecycle";
const token = "internal-service-token-with-at-least-32-characters";
const binding = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
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

function logger(): { logger: GatewayLogger; output: string[] } {
  const output: string[] = [];
  const write = (bindings: Record<string, unknown>, message?: string) =>
    output.push(JSON.stringify({ bindings, message }));
  return { logger: { debug: write, info: write, warn: write, error: write }, output };
}

describe("account lifecycle sink", () => {
  it("serializes bound open and close writes and preserves masked identity only", async () => {
    const bindings = new AccountBindingStore(memoryStore());
    await bindings.set(binding);
    const calls: Array<Record<string, unknown>> = [];
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json({ status: "accepted" }, { status: 202 });
      },
    );
    const logs = logger();
    const sink = new HttpAccountLifecycleSink(
      endpoint,
      token,
      bindings,
      logs.logger,
      fetchImplementation as typeof fetch,
    );

    sink.connected("62812****789");
    sink.disconnected();
    await sink.flush();

    expect(calls.map((call) => call.state)).toEqual(["connected", "disconnected"]);
    expect(calls[0]).toMatchObject({ binding, phoneNumberMasked: "62812****789" });
    expect(JSON.stringify(calls)).not.toContain("628123456789");
    expect(logs.output.join("\n")).toContain("wa.account.lifecycle.connected");
    expect(logs.output.join("\n")).toContain("wa.account.lifecycle.disconnected");
    expect(sink.getStatus().state).toBe("ok");
  });

  it("does not call the web service without a validated binding", async () => {
    const fetchImplementation = vi.fn();
    const logs = logger();
    const sink = new HttpAccountLifecycleSink(
      endpoint,
      token,
      new AccountBindingStore(memoryStore()),
      logs.logger,
      fetchImplementation as typeof fetch,
    );

    sink.connected();
    await sink.flush();

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(logs.output.join("\n")).toContain("account_unbound");
  });

  it("retries transient failures and exposes a safe failed diagnostic", async () => {
    const bindings = new AccountBindingStore(memoryStore());
    await bindings.set(binding);
    const logs = logger();
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 503 }));
    const sink = new HttpAccountLifecycleSink(
      endpoint,
      token,
      bindings,
      logs.logger,
      fetchImplementation as typeof fetch,
      2,
    );

    sink.connected();
    await sink.flush();

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sink.getStatus().state).toBe("failed");
    expect(logs.output.join("\n")).toContain("wa.account.lifecycle.persistence_failed");
    expect(logs.output.join("\n")).not.toContain(token);
  });
});
