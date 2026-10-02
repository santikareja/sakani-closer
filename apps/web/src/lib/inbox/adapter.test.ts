import { describe, expect, it } from "vitest";

import type { ConversationDetailDto, ConversationSummaryDto } from "./types";
import {
  createConversationDetailView,
  createConversationView,
  filterConversationViews,
  groupMessagesByDate,
} from "./adapter";

const summary: ConversationSummaryDto = {
  id: "00000000-0000-4000-8000-000000000001",
  contactName: "Rani Saputri",
  phoneMasked: "62812****789",
  status: "open",
  accountStatus: "connected",
  lastMessageAt: "2026-10-02T03:00:00.000Z",
  lastMessagePreview: "Saya ingin melihat lokasi",
  lastMessageType: "text",
};

describe("inbox presentation adapter", () => {
  it("keeps unsupported fields nullable and supports local search", () => {
    const view = createConversationView(summary, new Date("2026-10-02T04:00:00.000Z"));
    expect(view.unreadCount).toBeNull();
    expect(view.assigneeName).toBeNull();
    expect(view.lastMessageRelative).toContain("jam");
    expect(filterConversationViews([view], "rani", "all")).toHaveLength(1);
    expect(filterConversationViews([view], "tidak ada", "all")).toHaveLength(0);
    expect(filterConversationViews([view], "", "unread")).toHaveLength(0);
  });

  it("orders timeline messages chronologically and groups them by Jakarta date", () => {
    const detail: ConversationDetailDto = {
      id: summary.id,
      contactName: summary.contactName,
      phoneMasked: "62812****789",
      status: "open",
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000003",
          direction: "inbound",
          messageType: "text",
          text: "Pesan kedua",
          providerTimestamp: "2026-10-02T04:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          direction: "inbound",
          messageType: "text",
          text: "Pesan pertama",
          providerTimestamp: "2026-10-02T03:00:00.000Z",
        },
      ],
    };
    const view = createConversationDetailView(detail);
    expect(view.messages.map((message) => message.text)).toEqual(["Pesan pertama", "Pesan kedua"]);
    expect(groupMessagesByDate(view.messages)).toHaveLength(1);
    expect(view.messages.every((message) => message.deliveryStatus === null)).toBe(true);
  });
});
