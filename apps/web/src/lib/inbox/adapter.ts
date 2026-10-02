import type { ConversationDetailDto, ConversationSummaryDto, MessageDto } from "./types";
import type {
  InboxCapabilityMap,
  InboxConversationDetailView,
  InboxConversationView,
  InboxFilter,
  InboxMessageGroup,
  InboxMessageView,
} from "../../types/inbox";

export const inboxCapabilities: InboxCapabilityMap = {
  search: "available",
  unread: "unavailable",
  assignment: "unavailable",
  attention: "unavailable",
  historyImport: "unavailable",
  outboundReply: "unavailable",
  realtimeTyping: "unavailable",
};

export function formatRelativeTime(value: string, now = new Date()): string {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1_000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  if (absoluteSeconds < 60) return formatter.format(seconds, "second");
  if (absoluteSeconds < 3_600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absoluteSeconds < 86_400) return formatter.format(Math.round(seconds / 3_600), "hour");
  if (absoluteSeconds < 604_800) return formatter.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}

export function createConversationView(
  conversation: ConversationSummaryDto,
  now = new Date(),
): InboxConversationView {
  return {
    id: conversation.id,
    contactName: conversation.contactName,
    identifierMasked: conversation.phoneMasked ?? null,
    status: conversation.status,
    accountStatus: conversation.accountStatus,
    accountLabel: null,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageRelative: formatRelativeTime(conversation.lastMessageAt, now),
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageType: conversation.lastMessageType,
    unreadCount: null,
    assigneeName: null,
    needsAttention: null,
  };
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function createMessageView(message: MessageDto): InboxMessageView {
  return {
    id: message.id,
    direction: message.direction,
    messageType: message.messageType,
    text: message.text ?? null,
    providerTimestamp: message.providerTimestamp,
    timeLabel: formatMessageTime(message.providerTimestamp),
    deliveryStatus: null,
    media: message.media
      ? {
          mimeType: message.media.mimeType,
          fileName: message.media.fileName ?? null,
          fileSize: message.media.fileSize ?? null,
          processingStatus: message.media.processingStatus,
        }
      : null,
  };
}

export function groupMessagesByDate(messages: InboxMessageView[]): InboxMessageGroup[] {
  const groups = new Map<string, InboxMessageView[]>();
  for (const message of messages) {
    const date = new Date(message.providerTimestamp);
    const key = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
    const current = groups.get(key) ?? [];
    current.push(message);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([dateKey, group]) => ({
    dateKey,
    dateLabel: new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(group[0]!.providerTimestamp)),
    messages: group,
  }));
}

export function createConversationDetailView(
  conversation: ConversationDetailDto,
): InboxConversationDetailView {
  const messages = [...conversation.messages].reverse().map(createMessageView);
  return {
    id: conversation.id,
    contactName: conversation.contactName,
    identifierMasked: conversation.phoneMasked ?? null,
    status: conversation.status,
    messages,
    messageGroups: groupMessagesByDate(messages),
    nextCursor: conversation.nextCursor ?? null,
  };
}

export function filterConversationViews(
  conversations: InboxConversationView[],
  query: string,
  filter: InboxFilter,
): InboxConversationView[] {
  if (filter !== "all") return [];
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  if (!normalized) return conversations;
  return conversations.filter((conversation) =>
    [conversation.contactName, conversation.identifierMasked, conversation.lastMessagePreview]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("id-ID").includes(normalized)),
  );
}
