import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("protected owner inbox page", () => {
  it("requires a session, disables static caching, and exposes only safe diagnostics", async () => {
    const page = await readFile("apps/web/src/app/dashboard/inbox/page.tsx", "utf8");

    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain('requireSession("/dashboard/inbox")');
    expect(page).toContain('session.role === "owner"');
    expect(page).toContain("Status akun");
    expect(page).toContain("Total percakapan");
    expect(page).toContain("Event terakhir diterima");
    expect(page).toContain("Status ingestion terakhir");
    expect(page).toContain("Muat ulang");
    expect(page).not.toContain("INTERNAL_SERVICE_TOKEN");
    expect(page).not.toContain("remoteJid");
    expect(page).not.toContain("authState");
  });
});
