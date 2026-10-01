export interface ConversationSummaryDto {
  id: string;
  contactName: string;
  phoneMasked?: string;
  status: string;
  accountStatus: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageType: "text" | "image" | "document";
}

export interface ConversationListDto {
  conversations: ConversationSummaryDto[];
  nextCursor?: string;
}

export interface MessageDto {
  id: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "document";
  text?: string;
  providerTimestamp: string;
  media?: {
    mimeType: string;
    fileName?: string;
    fileSize?: number;
    processingStatus: string;
  };
}

export interface ConversationDetailDto {
  id: string;
  contactName: string;
  phoneMasked?: string;
  status: string;
  messages: MessageDto[];
  nextCursor?: string;
}
