import { requireSession } from "../../lib/auth/dal";
import { getLiveHealthReport, type HealthReport } from "../../lib/health";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function loadPhaseZeroStatus(): Promise<HealthReport["status"]> {
  try {
    return (await getLiveHealthReport()).status;
  } catch {
    return "error";
  }
}

export default async function DashboardPage() {
  const [session, phaseZeroStatus] = await Promise.all([requireSession(), loadPhaseZeroStatus()]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Dashboard terlindungi</p>
          <h1>Sakani Closer</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary-action" type="submit">
            Keluar
          </button>
        </form>
      </header>

      <section className="dashboard-grid" aria-label="Ringkasan akun">
        <article className="dashboard-card">
          <p className="card-label">Owner aktif</p>
          <h2>{session.displayName ?? "Owner"}</h2>
          <p>{session.email}</p>
        </article>
        <article className="dashboard-card">
          <p className="card-label">Workspace aktif</p>
          <h2>{session.workspaceName}</h2>
          <p>Peran: {session.role}</p>
        </article>
        <article className="dashboard-card">
          <p className="card-label">Status Phase 0</p>
          <h2>{phaseZeroStatus === "ok" ? "Semua layanan sehat" : "Perlu diperiksa"}</h2>
          <p>Database dan Redis diperiksa langsung saat halaman dimuat.</p>
        </article>
      </section>

      <section className="dashboard-settings" aria-labelledby="settings-title">
        <p className="eyebrow">Pengaturan</p>
        <h2 id="settings-title">Integrasi layanan</h2>
        <Link className="dashboard-card dashboard-card-link" href="/dashboard/settings/whatsapp">
          <span>
            <strong>WhatsApp</strong>
            <small>QR login dan status koneksi akun test</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="boundary" aria-labelledby="phase-title">
        <h2 id="phase-title">Phase 2B aktif</h2>
        <p>
          QR login WhatsApp tersedia untuk satu akun test. Pengiriman pesan, AI, RAG, CRM, dan
          automasi tetap belum diaktifkan.
        </p>
      </section>
    </main>
  );
}
