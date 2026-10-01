import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Phase 2B web security boundaries", () => {
  it("protects the settings page with the owner session guard", async () => {
    const source = await readFile("apps/web/src/app/dashboard/settings/whatsapp/page.tsx", "utf8");

    expect(source).toContain('requireSession("/dashboard/settings/whatsapp")');
  });

  it("keeps QR out of URLs, browser persistence, and database code", async () => {
    const source = await readFile(
      "apps/web/src/app/dashboard/settings/whatsapp/whatsapp-settings-client.tsx",
      "utf8",
    );

    expect(source).toContain('fetch("/api/v1/whatsapp/qr"');
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("URLSearchParams");
    expect(source).not.toContain("@sakani/database");
  });
});
