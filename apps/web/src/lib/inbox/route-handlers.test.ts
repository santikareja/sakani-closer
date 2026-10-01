import type { WorkspaceContext } from "@sakani/database";
import { describe, expect, it, vi } from "vitest";

import type { CurrentSession } from "../auth/types";
import type { InboxRepository, InboxQuery } from "./repository";
import { handleConversationDetail, handleConversationList } from "./route-handlers";
import type { ConversationDetailDto, ConversationListDto } from "./types";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000002";
const conversationId = "00000000-0000-4000-8000-000000000003";

function session(activeWorkspaceId = workspaceId): CurrentSession {
  return {
    sessionId: "00000000-0000-4000-8000-000000000010",
    userId: "00000000-0000-4000-8000-000000000011",
    email: "owner@example.com",
    displayName: "Owner",
    workspaceId: activeWorkspaceId,
    workspaceName: "Sakani",
    role: "owner",
    expiresAt: new Date("2026-10-09T00:00:00.000Z"),
  };
}

function fakeRepository(): InboxRepository {
  return {
    listConversations: vi.fn(
      async (context: WorkspaceContext, query: InboxQuery = {}): Promise<ConversationListDto> => ({
        conversations:
          context.workspaceId === workspaceId
            ? [
                {
                  id: conversationId,
                  contactName: "Pembeli Test",
                  phoneMasked: "62812****789",
                  status: "open",
                  accountStatus: "connected",
                  lastMessageAt: "2026-10-02T00:00:00.000Z",
                  lastMessagePreview: "Halo",
                  lastMessageType: "text",
                },
              ]
            : [],
        ...(query.cursor ? {} : { nextCursor: "next-safe-cursor" }),
      }),
    ),
    getConversation: vi.fn(
      async (context: WorkspaceContext, id: string): Promise<ConversationDetailDto | null> =>
        context.workspaceId === workspaceId && id === conversationId
          ? {
              id,
              contactName: "Pembeli Test",
              phoneMasked: "62812****789",
              status: "open",
              messages: [
                {
                  id: "00000000-0000-4000-8000-000000000004",
                  direction: "inbound",
                  messageType: "text",
                  text: "Halo",
                  providerTimestamp: "2026-10-02T00:00:00.000Z",
                },
              ],
            }
          : null,
    ),
    recordInboxViewed: vi.fn(async () => undefined),
  };
}

describe("protected inbox route handlers", () => {
  it("denies an unauthenticated inbox read", async () => {
    const repository = fakeRepository();
    const response = await handleConversationList(
      new Request("https://sakani.example/api/v1/conversations"),
      { getSession: async () => null, repository },
    );
    expect(response.status).toBe(401);
    expect(repository.listConversations).not.toHaveBeenCalled();
  });

  it("uses only the session workspace and returns a pagination cursor", async () => {
    const repository = fakeRepository();
    const response = await handleConversationList(
      new Request("https://sakani.example/api/v1/conversations?limit=1"),
      { getSession: async () => session(), repository },
    );
    const body = (await response.json()) as ConversationListDto;

    expect(response.status).toBe(200);
    expect(body.nextCursor).toBe("next-safe-cursor");
    expect(repository.listConversations).toHaveBeenCalledWith({ workspaceId }, { limit: 1 });
  });

  it("denies cross-workspace conversation access with a not-found response", async () => {
    const repository = fakeRepository();
    const response = await handleConversationDetail(
      new Request(`https://sakani.example/api/v1/conversations/${conversationId}`),
      conversationId,
      { getSession: async () => session(otherWorkspaceId), repository },
    );
    expect(response.status).toBe(404);
    expect(repository.getConversation).toHaveBeenCalledWith(
      { workspaceId: otherWorkspaceId },
      conversationId,
      {},
    );
  });

  it("returns a safe DTO without JID, token, or raw WAMessage", async () => {
    const repository = fakeRepository();
    const response = await handleConversationDetail(
      new Request(`https://sakani.example/api/v1/conversations/${conversationId}`),
      conversationId,
      { getSession: async () => session(), repository },
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toContain("remoteJid");
    expect(serialized).not.toContain("providerMessageId");
    expect(serialized).not.toContain("auth");
    expect(serialized).not.toContain("token");
  });
});
