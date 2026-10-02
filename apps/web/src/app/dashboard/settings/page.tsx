import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr/LockKey";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import Link from "next/link";

import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { requireSession } from "../../../lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession("/dashboard/settings");
  return (
    <div className="page-stack">
      <PageHeader
        title="Settings"
        description="Konfigurasi workspace yang tersedia saat ini dan batas kapabilitas backend."
      />
      <section className="settings-list">
        <Link className="settings-row" href="/dashboard/settings/whatsapp">
          <span className="surface-icon surface-icon-emerald" aria-hidden="true">
            <WhatsappLogoIcon size={21} weight="fill" />
          </span>
          <span>
            <strong>WhatsApp</strong>
            <small>Kelola koneksi, binding, QR, dan session gateway.</small>
          </span>
          <StatusBadge tone="success">Tersedia</StatusBadge>
          <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
        <div className="settings-row settings-row-disabled" aria-disabled="true">
          <span className="surface-icon" aria-hidden="true">
            <LockKeyIcon size={21} />
          </span>
          <span>
            <strong>AI Provider</strong>
            <small>Provider, model roles, dan encrypted key belum tersedia.</small>
          </span>
          <StatusBadge tone="neutral">Belum tersedia</StatusBadge>
        </div>
        <div className="settings-row settings-row-disabled" aria-disabled="true">
          <span className="surface-icon" aria-hidden="true">
            <LockKeyIcon size={21} />
          </span>
          <span>
            <strong>Team dan roles</strong>
            <small>Workspace saat ini menggunakan satu role owner.</small>
          </span>
          <StatusBadge tone="neutral">Belum tersedia</StatusBadge>
        </div>
      </section>
    </div>
  );
}
