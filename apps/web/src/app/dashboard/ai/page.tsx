import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";

import { ComingSoonCard } from "../../../components/ui/states";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createUnavailableAiWorkspace } from "../../../lib/ai/adapter";
import { requireSession } from "../../../lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function AiWorkspacePage() {
  await requireSession("/dashboard/ai");
  const workspace = createUnavailableAiWorkspace();

  return (
    <div className="page-stack">
      <PageHeader
        title="AI Workspace"
        description="Pusat kesiapan agent, dasar pengetahuan, dan kontrol kualitas sebelum AI diaktifkan."
        meta={<StatusBadge tone="neutral">Belum tersedia</StatusBadge>}
        actions={
          <button className="button button-primary" type="button" disabled>
            <LockKeyIcon size={18} aria-hidden="true" />
            Konfigurasi penyedia
          </button>
        }
      />

      <section className="ai-readiness-hero">
        <div className="ai-readiness-copy">
          <span className="surface-icon" aria-hidden="true">
            <SparkleIcon size={24} />
          </span>
          <div>
            <p>Kesiapan AI</p>
            <h2>{workspace.readinessLabel}</h2>
            <p>{workspace.readinessDescription}</p>
          </div>
        </div>
        <div className="ai-readiness-checks" aria-label="Prasyarat AI">
          <span>
            <CheckCircleIcon size={18} aria-hidden="true" />
            Alih kendali manusia wajib dipertahankan
          </span>
          <span>
            <ShieldCheckIcon size={18} aria-hidden="true" />
            Grounding dan audit harus aktif
          </span>
        </div>
      </section>

      <section className="capability-grid" aria-label="Kapabilitas AI">
        {workspace.capabilities.map((capability) => (
          <ComingSoonCard
            description={capability.description}
            key={capability.id}
            title={capability.label}
          />
        ))}
      </section>

      <section className="ai-workspace-grid">
        <article className="content-surface">
          <div className="section-heading-row">
            <div>
              <h2>Saran tindakan</h2>
              <p>Urutan aman sebelum mengaktifkan penyedia atau agent.</p>
            </div>
          </div>
          <ol className="readiness-list">
            <li>
              <span>1</span>
              <div>
                <strong>Tambahkan kontrak penyedia</strong>
                <p>Base URL, model roles, dan enkripsi key belum tersedia.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Aktifkan knowledge yang disetujui</strong>
                <p>Pencarian harus dibatasi per workspace dan memiliki jejak sumber.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Uji dalam mode bayangan</strong>
                <p>Jangan mengirim balasan sebelum validator dan audit lulus.</p>
              </div>
            </li>
          </ol>
        </article>
        <article className="content-surface unavailable-metric-surface">
          <h2>Usage dan kualitas</h2>
          <p>Belum ada event AI real.</p>
          <dl>
            <div>
              <dt>Proses AI</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>Grounded answers</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>Escalation rate</dt>
              <dd>-</dd>
            </div>
          </dl>
          <StatusBadge tone="info">Tidak ada demo data</StatusBadge>
        </article>
      </section>

      <section className="audit-note">
        <ShieldCheckIcon size={20} aria-hidden="true" />
        <div>
          <strong>Catatan audit</strong>
          <p>{workspace.auditNote}</p>
        </div>
      </section>
    </div>
  );
}
