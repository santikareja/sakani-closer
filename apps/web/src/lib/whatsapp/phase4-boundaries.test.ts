import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Phase 4 production boundaries", () => {
  it("blocks internal API paths at Caddy before proxying the web app", async () => {
    const caddyfile = await readFile("Caddyfile", "utf8");

    expect(caddyfile).toContain("app.sakani.id");
    expect(caddyfile).toContain("@internal path /api/v1/internal/*");
    expect(caddyfile).toContain("respond @internal 404");
    expect(caddyfile).toContain("reverse_proxy web:3000");
    expect(caddyfile).not.toContain("wa-gateway:3001");
    expect(caddyfile).not.toContain("postgres:5432");
    expect(caddyfile).not.toContain("redis:6379");
  });

  it("keeps the gateway receive-only in production source", async () => {
    const files = await readdir("apps/wa-gateway/src", { recursive: true, withFileTypes: true });
    const sourceFiles = files.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
    const productionSources = await Promise.all(
      sourceFiles
        .filter((entry) => !entry.name.endsWith(".test.ts"))
        .map((entry) => readFile(entry.parentPath + "/" + entry.name, "utf8")),
    );
    const production = productionSources.join("\n");

    expect(production).not.toContain(".sendMessage(");
    expect(production).not.toContain(".relayMessage(");
    expect(production).not.toContain(".sendPresence");
  });

  it("keeps exactly the three approved migration files", async () => {
    const files = await readdir("packages/database/drizzle");
    expect(files.filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()).toEqual([
      "0000_dry_anthem.sql",
      "0001_youthful_captain_america.sql",
      "0002_productive_kinsey_walden.sql",
    ]);
  });
});
