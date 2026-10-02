import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import Link from "next/link";

import { StatusBadge } from "../ui/status-badge";

export function AIStatusCard({ description }: { description: string }) {
  return (
    <article className="ai-status-card">
      <div className="surface-heading">
        <span className="surface-icon" aria-hidden="true">
          <SparkleIcon size={22} />
        </span>
        <StatusBadge tone="neutral">Belum tersedia</StatusBadge>
      </div>
      <div>
        <h2>Asisten AI</h2>
        <p>{description}</p>
      </div>
      <div className="connection-card-meta">
        <LockKeyIcon size={18} aria-hidden="true" />
        <span>Tidak ada proses AI aktif</span>
      </div>
      <Link className="inline-action" href="/dashboard/ai">
        Lihat kesiapan AI
      </Link>
    </article>
  );
}
