import type { ReactNode } from "react";

import { AppShell } from "../../components/dashboard/app-shell";
import { requireSession } from "../../lib/auth/dal";
import { createWhatsAppViewModel } from "../../lib/whatsapp/adapter";
import { getDashboardWhatsAppStatus } from "../../lib/whatsapp/status";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const gatewayStatus = session.role === "owner" ? await getDashboardWhatsAppStatus() : null;

  return (
    <AppShell
      session={{
        displayName: session.displayName,
        email: session.email,
        workspaceName: session.workspaceName,
        role: session.role,
      }}
      whatsapp={createWhatsAppViewModel(gatewayStatus, session.role)}
    >
      {children}
    </AppShell>
  );
}
