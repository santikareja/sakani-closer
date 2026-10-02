export type InboxAvailability = "available" | "unavailable";

export type InboxFilter = "all" | "unread" | "assigned" | "attention";

export interface InboxConversationView {
  id: string;
  contactName: string;
  identifierMasked: string | null;
  status: string;
  accountStatus: string;
  accountLabel: string | null;
  lastMessageAt: string;
  lastMessageRelative: string;
  lastMessagePreview: string;
  lastMessageType: "text" | "image" | "document";
  unreadCount: number | null;
  assigneeName: string | null;
  needsAttention: boolean | null;
}

export interface InboxMediaView {
  mimeType: string;
  fileName: string | null;
  fileSize: number | null;
  processingStatus: string;
}

export interface InboxMessageView {
  id: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "document";
  text: string | null;
  providerTimestamp: string;
  timeLabel: string;
  deliveryStatus: string | null;
  media: InboxMediaView | null;
}

export interface InboxMessageGroup {
  dateKey: string;
  dateLabel: string;
  messages: InboxMessageView[];
}

export interface InboxConversationDetailView {
  id: string;
  contactName: string;
  identifierMasked: string | null;
  status: string;
  messages: InboxMessageView[];
  messageGroups: InboxMessageGroup[];
  nextCursor: string | null;
}

export interface InboxCapabilityMap {
  search: InboxAvailability;
  unread: InboxAvailability;
  assignment: InboxAvailability;
  attention: InboxAvailability;
  historyImport: InboxAvailability;
  outboundReply: InboxAvailability;
  realtimeTyping: InboxAvailability;
}
