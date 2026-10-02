import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import Link from "next/link";

import type { WhatsAppViewModel } from "../../types/whatsapp";
import { StatusBadge, type StatusBadgeTone } from "../ui/status-badge";

function connectionTone(state: WhatsAppViewModel["connectionState"]): StatusBadgeTone {
  if (state === "connected") return "success";
  if (state === "connecting") return "warning";
  if (state === "disconnected") return "danger";
  return "neutral";
}

export function ConnectionCard({ whatsapp }: { whatsapp: WhatsAppViewModel }) {
  return (
    <article className="connection-card">
      <div className="surface-heading">
        <span className="surface-icon surface-icon-emerald" aria-hidden="true">
          <WhatsappLogoIcon size={22} weight="fill" />
        </span>
        <StatusBadge tone={connectionTone(whatsapp.connectionState)}>
          {whatsapp.connectionLabel}
        </StatusBadge>
      </div>
      <div>
        <h2>Koneksi WhatsApp</h2>
        <p>
          {whatsapp.phoneNumberMasked
            ? `Nomor ${whatsapp.phoneNumberMasked}`
            : "Belum ada nomor yang ditampilkan oleh gateway."}
        </p>
      </div>
      <div className="connection-card-meta">
        <ShieldCheckIcon size={18} aria-hidden="true" />
        <span>{whatsapp.gatewayHealthLabel}</span>
      </div>
      <Link className="inline-action" href="/dashboard/settings/whatsapp">
        Kelola koneksi
        <ArrowRightIcon size={17} aria-hidden="true" />
      </Link>
    </article>
  );
}
