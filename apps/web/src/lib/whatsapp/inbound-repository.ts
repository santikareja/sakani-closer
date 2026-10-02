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
import type { AcceptedInboundMessage, IgnoredInboundMessage } from "@sakani/shared";
import { DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID } from "@sakani/shared";
import { and, eq, sql } from "drizzle-orm";

import { InboundAccountNotFoundError, type InboundRepository } from "./inbound-types";

export function lifecycleUpdateValues(
  event: {
    state: "connected" | "disconnected";
    phoneNumberMasked?: string | undefined;
  },
  now: Date,
): Partial<typeof waAccounts.$inferInsert> {
  return event.state === "connected"
    ? {
        status: "connected",
        lastConnectedAt: now,
        updatedAt: now,
        ...(event.phoneNumberMasked ? { accountIdentifierMasked: event.phoneNumberMasked } : {}),
      }
    : { status: "disconnected", lastDisconnectedAt: now, updatedAt: now };
}

async function assertAccount(
  transaction: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  context: WorkspaceContext,
  accountId: string,
): Promise<void> {
  const [account] = await transaction
    .select({ id: waAccounts.id })
    .from(waAccounts)
    .where(
      and(
        eq(waAccounts.workspaceId, context.workspaceId),
        eq(waAccounts.id, accountId),
        eq(waAccounts.gatewayAccountId, DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID),
      ),
    )
    .limit(1);
  if (!account) throw new InboundAccountNotFoundError();
}

export class DrizzleInboundRepository implements InboundRepository {
  constructor(private readonly database: ReturnType<typeof getDatabase> = getDatabase()) {}

  async ensureAccount(context: WorkspaceContext): Promise<{ id: string }> {
    const [account] = await this.database
      .insert(waAccounts)
      .values({
        workspaceId: context.workspaceId,
        gatewayAccountId: DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID,
        label: "WhatsApp utama",
      })
      .onConflictDoUpdate({
        target: [waAccounts.workspaceId, waAccounts.gatewayAccountId],
        set: { updatedAt: new Date() },
      })
      .returning({ id: waAccounts.id });
    if (!account) throw new Error("WhatsApp account could not be prepared");
    return account;
  }

  async getAccount(context: WorkspaceContext): Promise<{
    id: string;
    gatewayAccountId: string;
    status: string;
    phoneNumberMasked: string | null;
    lastConnectedAt: Date | null;
    lastDisconnectedAt: Date | null;
    updatedAt: Date;
  } | null> {
    const [account] = await this.database
      .select({
        id: waAccounts.id,
        gatewayAccountId: waAccounts.gatewayAccountId,
        status: waAccounts.status,
        phoneNumberMasked: waAccounts.accountIdentifierMasked,
        lastConnectedAt: waAccounts.lastConnectedAt,
        lastDisconnectedAt: waAccounts.lastDisconnectedAt,
        updatedAt: waAccounts.updatedAt,
      })
      .from(waAccounts)
      .where(
        and(
          eq(waAccounts.workspaceId, context.workspaceId),
          eq(waAccounts.gatewayAccountId, DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID),
        ),
      )
      .limit(1);
    return account ?? null;
  }

  async markConnecting(context: WorkspaceContext, accountId: string): Promise<void> {
    await this.updateAccountStatus(context, accountId, {
      status: "connecting",
      updatedAt: new Date(),
    });
  }

  async markDisconnected(context: WorkspaceContext, accountId: string): Promise<void> {
    const now = new Date();
    await this.updateAccountStatus(context, accountId, {
      status: "disconnected",
      lastDisconnectedAt: now,
      updatedAt: now,
    });
  }

  async persistLifecycle(
    context: WorkspaceContext,
    accountId: string,
    event: {
      state: "connected" | "disconnected";
      phoneNumberMasked?: string | undefined;
    },
  ): Promise<void> {
    const now = new Date();
    await this.updateAccountStatus(context, accountId, lifecycleUpdateValues(event, now));
  }

  private async updateAccountStatus(
    context: WorkspaceContext,
    accountId: string,
    values: Partial<typeof waAccounts.$inferInsert>,
  ): Promise<void> {
    const updated = await this.database
      .update(waAccounts)
      .set(values)
      .where(
        and(
          eq(waAccounts.workspaceId, context.workspaceId),
          eq(waAccounts.id, accountId),
          eq(waAccounts.gatewayAccountId, DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID),
        ),
      )
      .returning({ id: waAccounts.id });
    if (updated.length === 0) throw new InboundAccountNotFoundError();
  }

  async ingestAccepted(
    context: WorkspaceContext,
    accountId: string,
    message: AcceptedInboundMessage,
  ): Promise<"created" | "duplicate"> {
    return this.database.transaction(async (transaction) => {
      await assertAccount(transaction, context, accountId);
      const now = new Date();
      const providerTimestamp = new Date(message.providerTimestamp);

      const [contact] = await transaction
        .insert(contacts)
        .values({
          workspaceId: context.workspaceId,
          waAccountId: accountId,
          waJidHash: message.chatIdentifierHash,
          displayName: message.displayName,
          phoneMasked: message.phoneMasked,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [contacts.workspaceId, contacts.waAccountId, contacts.waJidHash],
          set: {
            ...(message.displayName ? { displayName: message.displayName } : {}),
            ...(message.phoneMasked ? { phoneMasked: message.phoneMasked } : {}),
            updatedAt: now,
          },
        })
        .returning({ id: contacts.id });
      if (!contact) throw new Error("WhatsApp contact could not be resolved");

      const [newConversation] = await transaction
        .insert(conversations)
        .values({
          workspaceId: context.workspaceId,
          waAccountId: accountId,
          contactId: contact.id,
          lastMessageAt: providerTimestamp,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [conversations.workspaceId, conversations.waAccountId, conversations.contactId],
        })
        .returning({ id: conversations.id });

      const conversation =
        newConversation ??
        (
          await transaction
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.workspaceId, context.workspaceId),
                eq(conversations.waAccountId, accountId),
                eq(conversations.contactId, contact.id),
              ),
            )
            .limit(1)
        )[0];
      if (!conversation) throw new Error("WhatsApp conversation could not be resolved");

      const [storedMessage] = await transaction
        .insert(messages)
        .values({
          workspaceId: context.workspaceId,
          waAccountId: accountId,
          conversationId: conversation.id,
          providerMessageId: message.providerMessageId,
          direction: message.direction,
          messageType: message.messageType,
          text: message.text,
          providerTimestamp,
          fromMe: message.fromMe,
          processingStatus: "received",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [messages.workspaceId, messages.waAccountId, messages.providerMessageId],
        })
        .returning({ id: messages.id });

      if (!storedMessage) {
        await transaction.insert(auditLogs).values({
          workspaceId: context.workspaceId,
          action: "duplicate_message_ignored",
          entityType: "message",
          metadata: {
            accountId,
            providerMessageIdHash: message.providerMessageIdHash,
          },
          createdAt: now,
          updatedAt: now,
        });
        return "duplicate";
      }

      if (message.media) {
        await transaction.insert(messageMedia).values({
          workspaceId: context.workspaceId,
          messageId: storedMessage.id,
          mimeType: message.media.mimeType,
          fileName: message.media.fileName,
          fileSize: message.media.fileSize,
          processingStatus: "metadata_only",
          createdAt: now,
          updatedAt: now,
        });
      }

      await transaction
        .update(conversations)
        .set({
          lastMessageAt: sql`greatest(${conversations.lastMessageAt}, ${providerTimestamp})`,
          updatedAt: now,
        })
        .where(
          and(
            eq(conversations.workspaceId, context.workspaceId),
            eq(conversations.waAccountId, accountId),
            eq(conversations.id, conversation.id),
          ),
        );

      await transaction.insert(auditLogs).values([
        ...(newConversation
          ? [
              {
                workspaceId: context.workspaceId,
                action: "conversation_created",
                entityType: "conversation",
                metadata: { accountId, conversationId: conversation.id },
                createdAt: now,
                updatedAt: now,
              },
            ]
          : []),
        {
          workspaceId: context.workspaceId,
          action: "message_received",
          entityType: "message",
          metadata: {
            accountId,
            conversationId: conversation.id,
            messageId: storedMessage.id,
            providerMessageIdHash: message.providerMessageIdHash,
            messageType: message.messageType,
          },
          createdAt: now,
          updatedAt: now,
        },
      ]);
      return "created";
    });
  }

  async recordIgnored(
    context: WorkspaceContext,
    accountId: string,
    message: IgnoredInboundMessage,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await assertAccount(transaction, context, accountId);
      const now = new Date();
      await transaction.insert(auditLogs).values({
        workspaceId: context.workspaceId,
        action: "message_ignored",
        entityType: "message",
        metadata: {
          accountId,
          reason: message.reason,
          ...(message.providerMessageIdHash
            ? { providerMessageIdHash: message.providerMessageIdHash }
            : {}),
        },
        createdAt: now,
        updatedAt: now,
      });
    });
  }
}
