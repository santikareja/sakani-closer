import type { WorkspaceContext } from "@sakani/database";
import {
  DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID,
  type AcceptedInboundMessage,
  type IgnoredInboundMessage,
  type WhatsAppInboundEvent,
} from "@sakani/shared";
import { describe, expect, it, vi } from "vitest";

import { handleWhatsAppInboundEvent } from "./inbound-handler";
import { InboundAccountNotFoundError, type InboundRepository } from "./inbound-types";

const token = "internal-service-token-with-at-least-32-characters";
const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000002";
const accountId = "00000000-0000-4000-8000-000000000003";
const fullText = "Pesan pribadi yang tidak boleh masuk log";

const accepted: AcceptedInboundMessage = {
  outcome: "accepted",
  providerMessageId: "provider-1",
  providerMessageIdHash: "a".repeat(64),
  chatIdentifierHash: "b".repeat(64),
  displayName: "Pembeli Test",
  phoneMasked: "62812****789",
  direction: "inbound",
  messageType: "text",
  text: fullText,
  providerTimestamp: "2026-10-02T00:00:00.000Z",
  fromMe: false,
};

class InMemoryInboundRepository implements InboundRepository {
  readonly accounts = new Map<string, string>();
  readonly contacts = new Set<string>();
  readonly conversations = new Set<string>();
  readonly messages = new Set<string>();
  readonly ignored: IgnoredInboundMessage[] = [];

  addAccount(
    workspace: string,
    account: string,
    gatewayAccountId = DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID,
  ): void {
    this.accounts.set(`${workspace}:${account}`, gatewayAccountId);
  }

  async ensureAccount(context: WorkspaceContext): Promise<{ id: string }> {
    this.addAccount(context.workspaceId, accountId);
    return { id: accountId };
  }

  async ingestAccepted(
    context: WorkspaceContext,
    account: string,
    message: AcceptedInboundMessage,
  ): Promise<"created" | "duplicate"> {
    if (
      this.accounts.get(`${context.workspaceId}:${account}`) !== DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID
    ) {
      throw new InboundAccountNotFoundError();
    }
    const key = `${context.workspaceId}:${account}:${message.providerMessageId}`;
    if (this.messages.has(key)) return "duplicate";
    this.contacts.add(`${context.workspaceId}:${account}:${message.chatIdentifierHash}`);
    this.conversations.add(`${context.workspaceId}:${account}:${message.chatIdentifierHash}`);
    this.messages.add(key);
    return "created";
  }

  async recordIgnored(
    context: WorkspaceContext,
    account: string,
    message: IgnoredInboundMessage,
  ): Promise<void> {
    if (
      this.accounts.get(`${context.workspaceId}:${account}`) !== DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID
    ) {
      throw new InboundAccountNotFoundError();
    }
    this.ignored.push(message);
  }
}

function event(message: WhatsAppInboundEvent["message"] = accepted): WhatsAppInboundEvent {
  return { version: 1, binding: { workspaceId, accountId }, message };
}

function request(payload: WhatsAppInboundEvent, authorization = `Bearer ${token}`): Request {
  return new Request("http://web:3000/api/v1/internal/whatsapp/messages", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function setup() {
  const repository = new InMemoryInboundRepository();
  repository.addAccount(workspaceId, accountId);
  const output: string[] = [];
  const write = (bindings: Record<string, unknown>, message?: string) =>
    output.push(JSON.stringify({ bindings, message }));
  const sendMessage = vi.fn();
  return {
    repository,
    output,
    sendMessage,
    dependencies: {
      internalServiceToken: token,
      repository,
      logger: { info: write, error: write },
      sendMessage,
    },
  };
}

describe("receive-only WhatsApp ingestion boundary", () => {
  it("creates one contact, conversation, and message for the first inbound event", async () => {
    const { dependencies, repository } = setup();
    const response = await handleWhatsAppInboundEvent(request(event()), dependencies);

    expect(response.status).toBe(202);
    expect(repository.contacts.size).toBe(1);
    expect(repository.conversations.size).toBe(1);
    expect(repository.messages.size).toBe(1);
  });

  it("deduplicates repeated provider message IDs", async () => {
    const { dependencies, repository } = setup();
    const first = await handleWhatsAppInboundEvent(request(event()), dependencies);
    const duplicate = await handleWhatsAppInboundEvent(request(event()), dependencies);

    expect(first.status).toBe(202);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ status: "duplicate" });
    expect(repository.messages.size).toBe(1);
  });

  it("is idempotent under concurrent duplicate delivery", async () => {
    const { dependencies, repository } = setup();
    await Promise.all(
      Array.from({ length: 10 }, () => handleWhatsAppInboundEvent(request(event()), dependencies)),
    );
    expect(repository.messages.size).toBe(1);
  });

  it("enforces the workspace and account binding", async () => {
    const { dependencies, repository } = setup();
    repository.addAccount(otherWorkspaceId, accountId);
    const mismatched = event();
    mismatched.binding.workspaceId = "00000000-0000-4000-8000-000000000099";

    const response = await handleWhatsAppInboundEvent(request(mismatched), dependencies);
    expect(response.status).toBe(404);
    expect(repository.messages.size).toBe(0);
  });

  it("rejects an account ID that does not belong to the bound workspace", async () => {
    const { dependencies, repository } = setup();
    const mismatched = event();
    mismatched.binding.accountId = "00000000-0000-4000-8000-000000000099";

    const response = await handleWhatsAppInboundEvent(request(mismatched), dependencies);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      status: "rejected",
      error: { code: "ACCOUNT_BINDING_NOT_FOUND" },
    });
    expect(repository.messages.size).toBe(0);
  });

  it("rejects a non-default gateway account in the same workspace", async () => {
    const { dependencies, repository } = setup();
    const secondaryAccountId = "00000000-0000-4000-8000-000000000098";
    repository.addAccount(workspaceId, secondaryAccountId, "secondary");
    const mismatched = event();
    mismatched.binding.accountId = secondaryAccountId;

    const response = await handleWhatsAppInboundEvent(request(mismatched), dependencies);
    expect(response.status).toBe(404);
    expect(repository.messages.size).toBe(0);
  });

  it("rejects unauthorized internal ingestion before persistence", async () => {
    const { dependencies, repository } = setup();
    const response = await handleWhatsAppInboundEvent(
      request(event(), "Bearer wrong"),
      dependencies,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: "rejected" });
    expect(repository.messages.size).toBe(0);
  });

  it("records ignored group events without creating inbox records", async () => {
    const { dependencies, repository } = setup();
    const response = await handleWhatsAppInboundEvent(
      request(
        event({
          outcome: "ignored",
          reason: "group",
          providerMessageIdHash: "c".repeat(64),
        }),
      ),
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(repository.ignored).toHaveLength(1);
    expect(repository.contacts.size).toBe(0);
    expect(repository.conversations.size).toBe(0);
    expect(repository.messages.size).toBe(0);
  });

  it("never calls an outbound send function", async () => {
    const { dependencies, sendMessage } = setup();
    await handleWhatsAppInboundEvent(request(event()), dependencies);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("returns only a status and keeps raw payload data out of logs", async () => {
    const { dependencies, output } = setup();
    const response = await handleWhatsAppInboundEvent(request(event()), dependencies);
    const body = JSON.stringify(await response.json());
    const logs = output.join("\n");

    expect(body).toBe('{"status":"accepted"}');
    expect(body).not.toContain("remoteJid");
    expect(logs).not.toContain(fullText);
    expect(logs).not.toContain("628123456789@s.whatsapp.net");
    expect(logs).not.toContain(token);
  });
});
