import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { inspectMigrationDirectory } from "../scripts/assert-migrations";

describe("database migration packaging", () => {
  it("contains every migration referenced by the committed Drizzle journal", async () => {
    const result = await inspectMigrationDirectory();

    expect(result.sqlFiles).toEqual([
      "0000_dry_anthem.sql",
      "0001_youthful_captain_america.sql",
      "0002_productive_kinsey_walden.sql",
    ]);
    expect(result.journalEntries).toBe(3);
    expect(result.snapshotFiles).toContain("0002_snapshot.json");
  });

  it("builds a dedicated tools image and verifies artifacts before migration", async () => {
    const [dockerfile, compose, rootPackage, dockerIgnore] = await Promise.all([
      readFile("apps/web/Dockerfile", "utf8"),
      readFile("docker-compose.yml", "utf8"),
      readFile("package.json", "utf8"),
      readFile(".dockerignore", "utf8"),
    ]);

    expect(dockerfile).toContain("FROM builder AS database-tools");
    expect(dockerfile).toContain("WORKDIR /app/packages/database");
    expect(dockerfile).toContain("RUN pnpm db:assert-migrations");
    expect(compose).toContain("target: database-tools");
    expect(compose).toContain(
      "pnpm db:assert-migrations && pnpm db:migrate && pnpm db:verify-schema",
    );
    expect(rootPackage).toContain('"docker:verify-migrations"');
    expect(rootPackage).toContain("docker compose --profile tools build migrate");
    expect(dockerIgnore).not.toMatch(/^\*\.sql$/m);
    expect(dockerIgnore).not.toContain("packages/database/drizzle");
  });
});
