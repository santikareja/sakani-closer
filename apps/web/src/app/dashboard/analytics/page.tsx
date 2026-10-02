import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";

import { ChartPlaceholder } from "../../../components/ui/chart-placeholder";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";

export const dynamic = "force-dynamic";

const metrics = [
  { label: "Volume percakapan", description: "Agregasi belum tersedia" },
  { label: "Waktu respons", description: "Membutuhkan fase outbound" },
  { label: "Tingkat resolusi", description: "Status resolusi belum tersedia" },
  { label: "Tingkat bantuan AI", description: "Belum ada proses AI" },
];

export default async function AnalyticsPage() {
  await requireSession("/dashboard/analytics");
  return (
    <div className="page-stack">
      <PageHeader
        title="Analytics"
        description="Kerangka analitik workspace tanpa angka demo yang menyerupai data produksi."
        meta={<StatusBadge tone="neutral">Tidak ada demo data</StatusBadge>}
        actions={
          <button className="button button-secondary" type="button" disabled>
            <CalendarBlankIcon size={18} aria-hidden="true" />
            Pilih rentang tanggal
          </button>
        }
      />

      <section className="analytics-metric-grid" aria-label="KPI analytics">
        {metrics.map((metric) => (
          <article className="analytics-metric" key={metric.label}>
            <div>
              <p>{metric.label}</p>
              <StatusBadge tone="neutral">Belum tersedia</StatusBadge>
            </div>
            <strong>-</strong>
            <small>{metric.description}</small>
          </article>
        ))}
      </section>

      <section className="analytics-chart-grid">
        <ChartPlaceholder
          title="Volume percakapan"
          description="Menunggu endpoint agregasi berbasis workspace."
        />
        <ChartPlaceholder
          title="Waktu respons"
          description="Belum dapat dihitung dalam mode receive-only."
        />
        <ChartPlaceholder
          title="Tingkat bantuan AI"
          description="Tidak ada event AI yang disimulasikan."
        />
      </section>

      <section className="audit-note">
        <LockKeyIcon size={20} aria-hidden="true" />
        <div>
          <strong>Data analytics belum terhubung</strong>
          <p>Semua nilai tetap kosong sampai endpoint agregasi tervalidasi tersedia.</p>
        </div>
      </section>
    </div>
  );
}
