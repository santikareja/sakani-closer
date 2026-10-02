import { ArchiveIcon } from "@phosphor-icons/react/dist/ssr/Archive";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel state-panel-empty">
      <span className="state-icon" aria-hidden="true">
        <ArchiveIcon size={24} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  retryHref,
}: {
  title?: string;
  description: string;
  retryHref?: string;
}) {
  return (
    <div className="state-panel state-panel-error" role="alert">
      <span className="state-icon" aria-hidden="true">
        <WarningCircleIcon size={24} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {retryHref ? (
        <Link className="button button-secondary" href={retryHref}>
          <ArrowClockwiseIcon size={18} aria-hidden="true" />
          Coba lagi
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <span className={`loading-skeleton ${className}`} aria-hidden="true" />;
}

export function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="coming-soon-card">
      <span className="state-icon" aria-hidden="true">
        <LockKeyIcon size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="availability-label">Belum tersedia</span>
    </article>
  );
}
