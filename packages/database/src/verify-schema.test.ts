import { describe, expect, it } from "vitest";

import {
  REQUIRED_INBOX_TABLES,
  RequiredSchemaMissingError,
  inspectRequiredSchema,
  verifyRequiredSchema,
  type SchemaVerificationQueryable,
} from "./verify-schema";

function queryable(options: {
  tables: string[];
  journalPresent?: boolean;
  migrationCount?: number;
}): SchemaVerificationQueryable {
  return {
    async query<T extends Record<string, unknown>>(queryText: string) {
      if (queryText.includes("information_schema.tables")) {
        return { rows: options.tables.map((table_name) => ({ table_name })) as unknown as T[] };
      }
      if (queryText.includes("to_regclass")) {
        return {
          rows: [
            {
              journal_name:
                options.journalPresent === false ? null : "drizzle.__drizzle_migrations",
            },
          ] as unknown as T[],
        };
      }
      return {
        rows: [{ migration_count: options.migrationCount ?? 3 }] as unknown as T[],
      };
    },
  };
}

describe("required inbox schema verification", () => {
  it("passes only when the journal and every inbox table exist", async () => {
    const result = await verifyRequiredSchema(
      queryable({ tables: [...REQUIRED_INBOX_TABLES], migrationCount: 3 }),
    );

    expect(result).toMatchObject({
      migrationJournalPresent: true,
      migrationCount: 3,
      missingTables: [],
    });
  });

  it("fails with safe table names when the inbox migration is absent", async () => {
    const database = queryable({ tables: ["wa_accounts"], migrationCount: 2 });

    const inspection = await inspectRequiredSchema(database);
    expect(inspection.missingTables).toEqual([
      "contacts",
      "conversations",
      "messages",
      "message_media",
    ]);
    await expect(verifyRequiredSchema(database)).rejects.toBeInstanceOf(RequiredSchemaMissingError);
  });

  it("fails when the Drizzle journal is missing", async () => {
    await expect(
      verifyRequiredSchema(
        queryable({ tables: [...REQUIRED_INBOX_TABLES], journalPresent: false }),
      ),
    ).rejects.toBeInstanceOf(RequiredSchemaMissingError);
  });
});
