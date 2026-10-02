import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatsCircle";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { GearIcon } from "@phosphor-icons/react/dist/ssr/Gear";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import Link from "next/link";

import { AIStatusCard } from "../../components/dashboard/ai-status-card";
import { ConnectionCard } from "../../components/dashboard/connection-card";
import { MetricCard } from "../../components/ui/metric-card";
import { EmptyState, ErrorState } from "../../components/ui/states";
import { PageHeader } from "../../components/ui/page-header";
import { StatusBadge } from "../../components/ui/status-badge";
import { requireSession } from "../../lib/auth/dal";
import { createDashboardViewModel } from "../../lib/dashboard/adapter";
import { DrizzleInboxRepository } from "../../lib/inbox/repository";
import { getDashboardWhatsAppStatus } from "../../lib/whatsapp/status";

export const dynamic = "force-dynamic";

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const session = await requireSession();
  const repository = new DrizzleInboxRepository();
  const workspace = { workspaceId: session.workspaceId };

  try {
    const [diagnostics, conversations, whatsapp] = await Promise.all([
      repository.getDiagnostics(workspace),
      repository.listConversations(workspace, { limit: 5 }),
      getDashboardWhatsAppStatus(),
    ]);
    const view = createDashboardViewModel({
      diagnostics,
      conversations,
      whatsapp,
      role: session.role,
    });

    return (
      <div className="page-stack">
        <PageHeader
          title={`Selamat datang, ${session.displayName?.split(" ")[0] ?? "Owner"}`}
          description="Pantau koneksi, percakapan masuk, dan kesiapan workspace dari satu tempat."
          meta={<StatusBadge tone="success">Workspace aktif</StatusBadge>}
          actions={
            <Link className="button button-primary" href="/dashboard/inbox">
              Buka inbox
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
          }
        />

        <section className="metric-grid" aria-label="Ringkasan workspace">
          {view.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </section>

        <section className="overview-grid" aria-label="Aktivitas utama">
          <article className="content-surface recent-conversations">
            <div className="section-heading-row">
              <div>
                <h2>Percakapan terbaru</h2>
                <p>Pesan yang terakhir diterima oleh workspace.</p>
              </div>
              <Link className="inline-action" href="/dashboard/inbox">
                Lihat semua
                <ArrowRightIcon size={17} aria-hidden="true" />
              </Link>
            </div>
            {view.recentConversations.length === 0 ? (
              <EmptyState
                title="Belum ada percakapan"
                description="Percakapan akan muncul setelah gateway menerima chat pribadi pertama."
              />
            ) : (
              <div className="recent-list">
                {view.recentConversations.map((conversation) => (
                  <Link
                    className="recent-row"
                    href={`/dashboard/inbox?conversation=${conversation.id}`}
                    key={conversation.id}
                  >
                    <span className="contact-avatar" aria-hidden="true">
                      {conversation.contactName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="recent-row-copy">
                      <strong>{conversation.contactName}</strong>
                      <small>{conversation.lastMessagePreview}</small>
                    </span>
                    <time dateTime={conversation.lastMessageAt}>
                      {conversation.lastMessageRelative}
                    </time>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <div className="overview-side-stack">
            <ConnectionCard whatsapp={view.whatsapp} />
            <AIStatusCard description={view.ai.description} />
          </div>
        </section>

        <section className="quick-actions-section" aria-labelledby="quick-actions-title">
          <div className="section-heading-row">
            <div>
              <h2 id="quick-actions-title">Akses cepat</h2>
              <p>Buka workflow yang sudah tersedia tanpa melewati batas receive-only.</p>
            </div>
          </div>
          <div className="quick-action-grid">
            <Link className="quick-action" href="/dashboard/inbox">
              <ChatsCircleIcon size={22} aria-hidden="true" />
              <span>
                <strong>Tinjau inbox</strong>
                <small>Baca percakapan masuk</small>
              </span>
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <Link className="quick-action" href="/dashboard/settings/whatsapp">
              <WhatsappLogoIcon size={22} aria-hidden="true" />
              <span>
                <strong>Kelola WhatsApp</strong>
                <small>Periksa koneksi dan binding</small>
              </span>
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <Link className="quick-action" href="/dashboard/settings">
              <GearIcon size={22} aria-hidden="true" />
              <span>
                <strong>Pengaturan</strong>
                <small>Lihat konfigurasi workspace</small>
              </span>
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="content-surface activity-surface" aria-labelledby="activity-title">
          <div className="section-heading-row">
            <div>
              <h2 id="activity-title">Aktivitas terbaru</h2>
              <p>Hanya event real yang tersedia dari backend saat ini.</p>
            </div>
          </div>
          <div className="activity-list">
            {view.activity.map((activity) => (
              <div className="activity-row" key={activity.id}>
                <span className="activity-icon" aria-hidden="true">
                  <ClockCounterClockwiseIcon size={19} />
                </span>
                <div>
                  <strong>{activity.title}</strong>
                  <p>{activity.description}</p>
                </div>
                <time dateTime={activity.occurredAt ?? undefined}>
                  {activity.occurredAt ? formatActivityTime(activity.occurredAt) : "Belum tersedia"}
                </time>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="page-stack">
        <PageHeader title="Overview" description="Ringkasan workspace Sakani Closer." />
        <ErrorState
          description="Ringkasan belum dapat dimuat. Koneksi dan data tetap tidak berubah."
          retryHref="/dashboard"
        />
      </div>
    );
  }
}
