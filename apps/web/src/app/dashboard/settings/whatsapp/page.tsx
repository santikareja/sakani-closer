import { PageHeader } from "../../../../components/ui/page-header";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { requireSession } from "../../../../lib/auth/dal";
import { getDashboardWhatsAppStatus } from "../../../../lib/whatsapp/status";
import { WhatsAppSettingsClient } from "./whatsapp-settings-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const session = await requireSession("/dashboard/settings/whatsapp");
  const initialStatus = await getDashboardWhatsAppStatus();

  return (
    <div className="page-stack whatsapp-settings-page">
      <PageHeader
        title="Koneksi WhatsApp"
        description="Kelola ikatan akun, QR, dan kesehatan gateway tanpa menampilkan status autentikasi atau token."
        meta={<StatusBadge tone="info">Kontrol owner</StatusBadge>}
      />
      <WhatsAppSettingsClient initialStatus={initialStatus} role={session.role} />
    </div>
  );
}
