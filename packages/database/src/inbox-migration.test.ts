import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationPath = "packages/database/drizzle/0002_productive_kinsey_walden.sql";

describe("Batch 1 inbox migration", () => {
  it("is additive and includes every workspace-scoped inbox table", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of ["wa_accounts", "contacts", "conversations", "messages", "message_media"]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
      expect(sql.slice(sql.indexOf(`CREATE TABLE "${table}"`))).toContain(
        '"workspace_id" uuid NOT NULL',
      );
    }
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });

  it("creates referenced composite unique indexes before foreign keys", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const indexName of [
      "wa_accounts_workspace_id_uidx",
      "contacts_workspace_id_uidx",
      "conversations_workspace_account_id_uidx",
      "messages_workspace_id_uidx",
    ]) {
      expect(sql.indexOf(`CREATE UNIQUE INDEX "${indexName}"`)).toBeGreaterThan(0);
      expect(sql.indexOf(`CREATE UNIQUE INDEX "${indexName}"`)).toBeLessThan(
        sql.indexOf('ALTER TABLE "contacts"'),
      );
    }
  });

  it("enforces provider-message idempotency by workspace and account", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "messages_workspace_account_provider_uidx" ON "messages" USING btree ("workspace_id","wa_account_id","provider_message_id")',
    );
  });
});
