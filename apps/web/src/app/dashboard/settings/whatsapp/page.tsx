import Link from "next/link";

import { requireSession } from "../../../../lib/auth/dal";
import { WhatsAppSettingsClient } from "./whatsapp-settings-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  await requireSession("/dashboard/settings/whatsapp");

  return (
    <main className="dashboard-shell whatsapp-settings-shell">
      <Link className="text-link back-link" href="/dashboard">
        ← Kembali ke dashboard
      </Link>
      <header className="settings-header">
        <p className="eyebrow">Pengaturan · WhatsApp</p>
        <h1>Hubungkan akun test</h1>
        <p className="lead">
          Buat QR hanya saat Anda siap memindainya. Gateway tidak terhubung otomatis saat container
          dimulai dan fitur pengiriman pesan belum tersedia.
        </p>
      </header>
      <WhatsAppSettingsClient />
    </main>
  );
}
