import type { InboxConversationView } from "./inbox";
import type { WhatsAppViewModel } from "./whatsapp";

export type MetricCapability = "live" | "unavailable" | "demo";

export interface DashboardMetric {
  id: "conversations" | "unread" | "messages-today" | "response-time";
  label: string;
  value: string | null;
  description: string;
  capability: MetricCapability;
}

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  occurredAt: string | null;
  isAvailable: boolean;
}

export interface DashboardViewModel {
  metrics: DashboardMetric[];
  whatsapp: WhatsAppViewModel;
  recentConversations: InboxConversationView[];
  activity: DashboardActivity[];
  ai: {
    isAvailable: false;
    label: "Belum tersedia";
    description: string;
  };
}
