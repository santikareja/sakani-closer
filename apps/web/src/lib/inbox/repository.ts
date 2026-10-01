import "server-only";

import {
  auditLogs,
  contacts,
  conversations,
  getDatabase,
  messageMedia,
  messages,
  waAccounts,
  type WorkspaceContext,
} from "@sakani/database";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { decodeInboxCursor, encodeInboxCursor } from "./cursor";
import type { ConversationDetailDto, ConversationListDto, MessageDto } from "./types";

const DEFAULT_PAGE_SIZE = 25;

export interface InboxQuery {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface InboxRepository {
  listConversations(context: WorkspaceContext, query?: InboxQuery): Promise<ConversationListDto>;
  getConversation(
    context: WorkspaceContext,
    conversationId: string,
    query?: InboxQuery,
  ): Promise<ConversationDetailDto | null>;
  recordInboxViewed(context: WorkspaceContext, actorUserId: string): Promise<void>;
}

function pageSize(value: number | undefined): number {
  return Math.min(50, Math.max(1, value ?? DEFAULT_PAGE_SIZE));
}

function preview(text: string | null, messageType: string): string {
  if (text) return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  if (messageType === "image") return "Gambar (metadata)";
  if (messageType === "document") return "Dokumen (metadata)";
  return "Pesan tanpa teks";
}

function safeMessageType(value: string): "text" | "image" | "document" {
  return value === "image" || value === "document" ? value : "text";
}

export class DrizzleInboxRepository implements InboxRepository {
  async listConversations(
    context: WorkspaceContext,
    query: InboxQuery = {},
  ): Promise<ConversationListDto> {
    const database = getDatabase();
    const limit = pageSize(query.limit);
    const cursor = decodeInboxCursor(query.cursor);
    const cursorPredicate = cursor
      ? or(
          lt(conversations.lastMessageAt, cursor.at),
          and(eq(conversations.lastMessageAt, cursor.at), lt(conversations.id, cursor.id)),
        )
      : undefined;

    const rows = await database
      .select({
        id: conversations.id,
        contactName: contacts.displayName,
        phoneMasked: contacts.phoneMasked,
        status: conversations.status,
        accountStatus: waAccounts.status,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .innerJoin(
        contacts,
        and(
          eq(contacts.workspaceId, context.workspaceId),
          eq(contacts.id, conversations.contactId),
        ),
      )
      .innerJoin(
        waAccounts,
        and(
          eq(waAccounts.workspaceId, context.workspaceId),
          eq(waAccounts.id, conversations.waAccountId),
        ),
      )
      .where(and(eq(conversations.workspaceId, context.workspaceId), cursorPredicate))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
      .limit(limit + 1);

    const visibleRows = rows.slice(0, limit);
    const summaries = await Promise.all(
      visibleRows.map(async (row) => {
        const [latest] = await database
          .select({ text: messages.text, messageType: messages.messageType })
          .from(messages)
          .where(
            and(eq(messages.workspaceId, context.workspaceId), eq(messages.conversationId, row.id)),
          )
          .orderBy(desc(messages.providerTimestamp), desc(messages.id))
          .limit(1);
        const messageType = safeMessageType(latest?.messageType ?? "text");
        return {
          id: row.id,
          contactName: row.contactName ?? row.phoneMasked ?? "Kontak WhatsApp",
          ...(row.phoneMasked ? { phoneMasked: row.phoneMasked } : {}),
          status: row.status,
          accountStatus: row.accountStatus,
          lastMessageAt: row.lastMessageAt.toISOString(),
          lastMessagePreview: preview(latest?.text ?? null, messageType),
          lastMessageType: messageType,
        };
      }),
    );

    const last = visibleRows.at(-1);
    return {
      conversations: summaries,
      ...(rows.length > limit && last
        ? { nextCursor: encodeInboxCursor({ at: last.lastMessageAt, id: last.id }) }
        : {}),
    };
  }

  async getConversation(
    context: WorkspaceContext,
    conversationId: string,
    query: InboxQuery = {},
  ): Promise<ConversationDetailDto | null> {
    const database = getDatabase();
    const [conversation] = await database
      .select({
        id: conversations.id,
        contactName: contacts.displayName,
        phoneMasked: contacts.phoneMasked,
        status: conversations.status,
      })
      .from(conversations)
      .innerJoin(
        contacts,
        and(
          eq(contacts.workspaceId, context.workspaceId),
          eq(contacts.id, conversations.contactId),
        ),
      )
      .where(
        and(
          eq(conversations.workspaceId, context.workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);
    if (!conversation) return null;

    const limit = pageSize(query.limit);
    const cursor = decodeInboxCursor(query.cursor);
    const cursorPredicate = cursor
      ? or(
          lt(messages.providerTimestamp, cursor.at),
          and(eq(messages.providerTimestamp, cursor.at), lt(messages.id, cursor.id)),
        )
      : undefined;
    const rows = await database
      .select({
        id: messages.id,
        direction: messages.direction,
        messageType: messages.messageType,
        text: messages.text,
        providerTimestamp: messages.providerTimestamp,
        mimeType: messageMedia.mimeType,
        fileName: messageMedia.fileName,
        fileSize: messageMedia.fileSize,
        mediaStatus: messageMedia.processingStatus,
      })
      .from(messages)
      .leftJoin(
        messageMedia,
        and(
          eq(messageMedia.workspaceId, context.workspaceId),
          eq(messageMedia.messageId, messages.id),
        ),
      )
      .where(
        and(
          eq(messages.workspaceId, context.workspaceId),
          eq(messages.conversationId, conversationId),
          cursorPredicate,
        ),
      )
      .orderBy(desc(messages.providerTimestamp), desc(messages.id))
      .limit(limit + 1);

    const visibleRows = rows.slice(0, limit);
    const safeMessages: MessageDto[] = visibleRows.map((row) => ({
      id: row.id,
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      messageType: safeMessageType(row.messageType),
      ...(row.text ? { text: row.text } : {}),
      providerTimestamp: row.providerTimestamp.toISOString(),
      ...(row.mimeType
        ? {
            media: {
              mimeType: row.mimeType,
              ...(row.fileName ? { fileName: row.fileName } : {}),
              ...(row.fileSize === null ? {} : { fileSize: row.fileSize }),
              processingStatus: row.mediaStatus ?? "metadata_only",
            },
          }
        : {}),
    }));
    const last = visibleRows.at(-1);
    return {
      id: conversation.id,
      contactName: conversation.contactName ?? conversation.phoneMasked ?? "Kontak WhatsApp",
      ...(conversation.phoneMasked ? { phoneMasked: conversation.phoneMasked } : {}),
      status: conversation.status,
      messages: safeMessages,
      ...(rows.length > limit && last
        ? {
            nextCursor: encodeInboxCursor({
              at: last.providerTimestamp,
              id: last.id,
            }),
          }
        : {}),
    };
  }

  async recordInboxViewed(context: WorkspaceContext, actorUserId: string): Promise<void> {
    await getDatabase().insert(auditLogs).values({
      workspaceId: context.workspaceId,
      actorUserId,
      action: "inbox_viewed",
      entityType: "inbox",
      metadata: {},
    });
  }
}
