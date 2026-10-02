import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { RobotIcon } from "@phosphor-icons/react/dist/ssr/Robot";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";

import { EmptyState } from "../../../components/ui/states";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  await requireSession("/dashboard/agents");
  return (
    <div className="page-stack">
      <PageHeader
        title="Agents"
        description="Ruang konfigurasi agent yang aman, berversi, dan dapat diaudit."
        meta={<StatusBadge tone="neutral">Kerangka frontend</StatusBadge>}
        actions={
          <button className="button button-primary" type="button" disabled>
            <LockKeyIcon size={18} aria-hidden="true" />
            Buat agent
          </button>
        }
      />

      <section className="agent-layout">
        <article className="content-surface">
          <div className="section-heading-row">
            <div>
              <h2>Daftar agent</h2>
              <p>Tidak ada agent fiktif yang ditampilkan.</p>
            </div>
            <div className="status-legend" aria-label="Status agent yang didukung">
              <StatusBadge tone="neutral">Draf</StatusBadge>
              <StatusBadge tone="success">Siap</StatusBadge>
              <StatusBadge tone="warning">Dijeda</StatusBadge>
            </div>
          </div>
          <EmptyState
            title="Belum ada agent"
            description="Agent akan muncul setelah endpoint pembuatan, versi, dan persetujuan tersedia."
          />
        </article>

        <aside className="agent-controls content-surface" aria-label="Kontrol agent belum tersedia">
          <span className="surface-icon" aria-hidden="true">
            <RobotIcon size={22} />
          </span>
          <h2>Konfigurasi model</h2>
          <p>Semua kontrol dinonaktifkan sampai kontrak backend tersedia.</p>
          <label>
            Penyedia dan model
            <input value="Belum tersedia" disabled readOnly />
          </label>
          <label>
            Temperature
            <input type="range" min="0" max="2" value="0" disabled readOnly />
          </label>
          <label>
            Batas token
            <input value="Belum tersedia" disabled readOnly />
          </label>
          <button className="button button-secondary button-full" type="button" disabled>
            <SlidersHorizontalIcon size={18} aria-hidden="true" />
            Simpan konfigurasi
          </button>
        </aside>
      </section>
    </div>
  );
}
