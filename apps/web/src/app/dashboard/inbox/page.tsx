import { z } from "zod";

import { ContactPanel } from "../../../components/inbox/contact-panel";
import { ConversationList } from "../../../components/inbox/conversation-list";
import { MessageTimeline } from "../../../components/inbox/message-timeline";
import { EmptyState, ErrorState } from "../../../components/ui/states";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";
import {
  createConversationDetailView,
  createConversationView,
  filterConversationViews,
} from "../../../lib/inbox/adapter";
import { decodeInboxCursor } from "../../../lib/inbox/cursor";
import { DrizzleInboxRepository } from "../../../lib/inbox/repository";
import { createWhatsAppViewModel } from "../../../lib/whatsapp/adapter";
import { getDashboardWhatsAppStatus } from "../../../lib/whatsapp/status";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  conversation: z.string().uuid().optional(),
  cursor: z
    .string()
    .max(512)
    .refine((value) => decodeInboxCursor(value) !== undefined)
    .optional(),
  messageCursor: z
    .string()
    .max(512)
    .refine((value) => decodeInboxCursor(value) !== undefined)
    .optional(),
  q: z.string().trim().max(120).default(""),
  filter: z.enum(["all", "unread", "assigned", "attention"]).default("all"),
});

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/dashboard/inbox");
  const raw = await searchParams;
  const parsed = searchSchema.safeParse({
    conversation: typeof raw.conversation === "string" ? raw.conversation : undefined,
    cursor: typeof raw.cursor === "string" ? raw.cursor : undefined,
    messageCursor: typeof raw.messageCursor === "string" ? raw.messageCursor : undefined,
    q: typeof raw.q === "string" ? raw.q : "",
    filter: typeof raw.filter === "string" ? raw.filter : "all",
  });
  const query = parsed.success ? parsed.data : searchSchema.parse({});
  const repository = new DrizzleInboxRepository();
  const workspace = { workspaceId: session.workspaceId };

  try {
    const [list, detail, diagnostics, gatewayStatus] = await Promise.all([
      repository.listConversations(workspace, { cursor: query.cursor }),
      query.conversation
        ? repository.getConversation(workspace, query.conversation, {
            cursor: query.messageCursor,
          })
        : Promise.resolve(null),
      session.role === "owner" ? repository.getDiagnostics(workspace) : Promise.resolve(null),
      getDashboardWhatsAppStatus(),
    ]);
    await repository.recordInboxViewed(workspace, session.userId);

    const now = new Date();
    const conversations = list.conversations.map((conversation) =>
      createConversationView(conversation, now),
    );
    const visibleConversations = filterConversationViews(conversations, query.q, query.filter);
    const detailView = detail ? createConversationDetailView(detail) : null;
    const selectedSummary = conversations.find((item) => item.id === detailView?.id) ?? null;
    const whatsapp = createWhatsAppViewModel(gatewayStatus, session.role);

    return (
      <div className="page-stack inbox-page-stack">
        <PageHeader
          title="Inbox"
          description="Baca percakapan WhatsApp masuk dengan aman dalam mode receive-only."
          meta={
            <StatusBadge tone={whatsapp.connectionState === "connected" ? "success" : "neutral"}>
              {whatsapp.connectionLabel}
            </StatusBadge>
          }
        />

        {diagnostics ? (
          <section className="inbox-health-strip" aria-label="Status ingestion inbox">
            <div>
              <span>Status ikatan</span>
              <strong>{whatsapp.bindingLabel}</strong>
            </div>
            <div>
              <span>Total percakapan</span>
              <strong>{diagnostics.totalConversations}</strong>
            </div>
            <div>
              <span>Event terakhir</span>
              <strong>
                {diagnostics.lastReceivedAt
                  ? formatDateTime(diagnostics.lastReceivedAt)
                  : "Belum ada"}
              </strong>
            </div>
            <div>
              <span>Ingestion</span>
              <strong>
                {diagnostics.lastIngestStatus === "accepted"
                  ? "Diterima"
                  : diagnostics.lastIngestStatus === "duplicate"
                    ? "Duplikat diabaikan"
                    : diagnostics.lastIngestStatus === "ignored"
                      ? "Diabaikan"
                      : "Belum ada"}
              </strong>
            </div>
          </section>
        ) : null}

        <div
          className={`inbox-workspace${detailView ? " inbox-workspace-selected" : ""}`}
          data-testid="inbox-workspace"
        >
          <ConversationList
            conversations={visibleConversations}
            nextCursor={list.nextCursor ?? null}
            query={query.q}
            selectedId={query.conversation}
          />
          {detailView ? (
            <>
              <MessageTimeline
                conversation={detailView}
                historyMode={Boolean(query.messageCursor)}
              />
              <ContactPanel conversation={detailView} summary={selectedSummary} />
            </>
          ) : (
            <section className="inbox-selection-empty" aria-label="Detail percakapan">
              <EmptyState
                title="Pilih percakapan"
                description="Pilih salah satu percakapan untuk membaca pesan dan melihat detail kontak."
              />
            </section>
          )}
        </div>
      </div>
    );
  } catch {
    return (
      <div className="page-stack">
        <PageHeader
          title="Inbox"
          description="Baca percakapan WhatsApp masuk dalam mode receive-only."
        />
        <ErrorState
          description="Pesan belum dapat dimuat. Tidak ada balasan otomatis yang dikirim."
          retryHref="/dashboard/inbox"
        />
      </div>
    );
  }
}
