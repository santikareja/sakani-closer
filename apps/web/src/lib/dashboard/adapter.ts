import type { InboxDiagnosticsDto, ConversationListDto } from "../inbox/types";
import type { WhatsAppStatusResponse } from "../whatsapp/contracts";
import { createWhatsAppViewModel } from "../whatsapp/adapter";
import { createConversationView } from "../inbox/adapter";
import type { DashboardViewModel } from "../../types/dashboard";

export function createDashboardViewModel(input: {
  diagnostics: InboxDiagnosticsDto;
  conversations: ConversationListDto;
  whatsapp: WhatsAppStatusResponse | null;
  role: string;
  now?: Date;
}): DashboardViewModel {
  const now = input.now ?? new Date();
  const recentConversations = input.conversations.conversations
    .slice(0, 5)
    .map((conversation) => createConversationView(conversation, now));

  return {
    metrics: [
      {
        id: "conversations",
        label: "Total percakapan",
        value: String(input.diagnostics.totalConversations),
        description: "Data aktual dari inbox workspace.",
        capability: "live",
      },
      {
        id: "unread",
        label: "Belum dibaca",
        value: null,
        description: "Status baca belum tersedia di backend.",
        capability: "unavailable",
      },
      {
        id: "messages-today",
        label: "Pesan hari ini",
        value: null,
        description: "Agregasi harian belum tersedia.",
        capability: "unavailable",
      },
      {
        id: "response-time",
        label: "Waktu respons",
        value: null,
        description: "Metrik respons membutuhkan fase outbound.",
        capability: "unavailable",
      },
    ],
    whatsapp: createWhatsAppViewModel(input.whatsapp, input.role),
    recentConversations,
    activity: input.diagnostics.lastReceivedAt
      ? [
          {
            id: "last-inbound",
            title: "Pesan masuk diterima",
            description: "Event terakhir tercatat oleh ingestion WhatsApp.",
            occurredAt: input.diagnostics.lastReceivedAt,
            isAvailable: true,
          },
        ]
      : [
          {
            id: "no-activity",
            title: "Belum ada aktivitas",
            description: "Aktivitas workspace akan muncul setelah pesan pertama diterima.",
            occurredAt: null,
            isAvailable: false,
          },
        ],
    ai: {
      isAvailable: false,
      label: "Belum tersedia",
      description:
        "Penyedia AI, dasar pengetahuan, dan audit proses belum memiliki kontrak backend aktif.",
    },
  };
}
