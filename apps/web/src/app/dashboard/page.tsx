import { requireSession } from "../../lib/auth/dal";
import { getLiveHealthReport, type HealthReport } from "../../lib/health";

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

      <section className="boundary" aria-labelledby="phase-title">
        <h2 id="phase-title">Phase 1 aktif</h2>
        <p>
          Autentikasi owner dan isolasi workspace sudah tersedia. WhatsApp, AI, RAG, CRM, dan
          automasi belum diaktifkan.
        </p>
      </section>
    </main>
  );
}
