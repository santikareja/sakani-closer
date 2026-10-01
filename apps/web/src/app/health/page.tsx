import Link from "next/link";

import { getLiveHealthReport, type HealthReport } from "../../lib/health";

export const dynamic = "force-dynamic";

async function loadHealth(): Promise<HealthReport> {
  try {
    return await getLiveHealthReport();
  } catch {
    const timestamp = new Date().toISOString();
    return {
      status: "error",
      app: { status: "ok", latencyMs: 0 },
      database: { status: "error", latencyMs: 0 },
      redis: { status: "error", latencyMs: 0 },
      environment: { app: "local", node: "production" },
      timestamp,
    };
  }
}

function StatusRow({
  label,
  status,
  latencyMs,
}: {
  label: string;
  status: string;
  latencyMs: number;
}) {
  return (
    <li className="status-row">
      <span>{label}</span>
      <span className={`status-pill status-${status}`}>
        {status === "ok" ? "Sehat" : "Bermasalah"} · {latencyMs} ms
      </span>
    </li>
  );
}

export default async function HealthPage() {
  const report = await loadHealth();

  return (
    <main className="shell">
      <section className="health-panel" aria-labelledby="health-title">
        <div className="health-heading">
          <div>
            <p className="eyebrow">Status operasional</p>
            <h1 id="health-title">Health check</h1>
          </div>
          <span className={`overall overall-${report.status}`}>
            {report.status === "ok" ? "Semua sehat" : "Perlu diperiksa"}
          </span>
        </div>

        <ul className="status-list">
          <StatusRow label="Aplikasi" {...report.app} />
          <StatusRow label="Database" {...report.database} />
          <StatusRow label="Redis" {...report.redis} />
        </ul>

        <dl className="metadata">
          <div>
            <dt>Environment</dt>
            <dd>{report.environment.app}</dd>
          </div>
          <div>
            <dt>Node mode</dt>
            <dd>{report.environment.node}</dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{report.timestamp}</dd>
          </div>
        </dl>

        <Link className="text-link" href="/">
          Kembali ke beranda
        </Link>
      </section>
    </main>
  );
}
