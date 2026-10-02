import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const dashboardFiles = [
  "apps/web/src/components/dashboard/app-shell.tsx",
  "apps/web/src/components/inbox/message-timeline.tsx",
  "apps/web/src/components/inbox/copilot-panel.tsx",
  "apps/web/src/app/dashboard/inbox/page.tsx",
  "apps/web/src/app/dashboard/settings/whatsapp/whatsapp-settings-client.tsx",
];

describe("dashboard frontend safety contracts", () => {
  it("contains accessible mobile navigation and reduced-motion handling", async () => {
    const [shell, styles] = await Promise.all([
      readFile(dashboardFiles[0]!, "utf8"),
      readFile("apps/web/src/app/styles.css", "utf8"),
    ]);
    expect(shell).toContain("<dialog");
    expect(shell).toContain("showModal()");
    expect(shell).toContain("Tutup navigasi");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("min-height: 100dvh");
  });

  it("does not expose secrets or add outbound messaging behavior", async () => {
    const source = (await Promise.all(dashboardFiles.map((file) => readFile(file, "utf8")))).join(
      "\n",
    );
    for (const forbidden of [
      "AUTH_SECRET",
      "SESSION_ENCRYPTION_KEY",
      "INTERNAL_SERVICE_TOKEN",
      "sendMessage(",
      "relayMessage(",
      "sendPresence",
      "broadcast",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain("Mode receive-only");
    expect(source).toContain("Balasan akan tersedia pada fase outbound yang disetujui");
  });

  it("renders future AI actions as disabled and never as completed runs", async () => {
    const copilot = await readFile(dashboardFiles[2]!, "utf8");
    expect(copilot).toContain("Buat saran");
    expect(copilot).toContain("disabled");
    expect(copilot).toContain("Tidak ada saran yang disimulasikan");
  });
});
