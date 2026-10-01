import { pathToFileURL } from "node:url";

import type { QueryResult } from "pg";

import { closeDatabase, getDatabasePool } from "./client";

export const REQUIRED_INBOX_TABLES = [
  "wa_accounts",
  "contacts",
  "conversations",
  "messages",
  "message_media",
] as const;

export interface SchemaVerificationQueryable {
  query<T extends Record<string, unknown>>(
    queryText: string,
    values?: unknown[],
  ): Promise<Pick<QueryResult<T>, "rows">>;
}

export interface SchemaVerificationResult {
  migrationJournalPresent: boolean;
  migrationCount: number;
  presentTables: string[];
  missingTables: string[];
}

export class RequiredSchemaMissingError extends Error {
  constructor(readonly result: SchemaVerificationResult) {
    super("Required inbox database schema is missing");
    this.name = "RequiredSchemaMissingError";
  }
}

export async function inspectRequiredSchema(
  database: SchemaVerificationQueryable,
): Promise<SchemaVerificationResult> {
  const tables = await database.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name`,
    [[...REQUIRED_INBOX_TABLES]],
  );
  const presentTables = tables.rows.map((row) => row.table_name);
  const missingTables = REQUIRED_INBOX_TABLES.filter((table) => !presentTables.includes(table));

  const journal = await database.query<{ journal_name: string | null }>(
    `select to_regclass('drizzle.__drizzle_migrations')::text as journal_name`,
  );
  const migrationJournalPresent = typeof journal.rows[0]?.journal_name === "string";
  let migrationCount = 0;
  if (migrationJournalPresent) {
    const count = await database.query<{ migration_count: number }>(
      `select count(*)::int as migration_count from drizzle.__drizzle_migrations`,
    );
    migrationCount = count.rows[0]?.migration_count ?? 0;
  }

  return { migrationJournalPresent, migrationCount, presentTables, missingTables };
}

export async function verifyRequiredSchema(
  database: SchemaVerificationQueryable,
): Promise<SchemaVerificationResult> {
  const result = await inspectRequiredSchema(database);
  if (!result.migrationJournalPresent || result.missingTables.length > 0) {
    throw new RequiredSchemaMissingError(result);
  }
  return result;
}

async function main(): Promise<void> {
  try {
    const result = await verifyRequiredSchema(getDatabasePool());
    process.stdout.write(
      `${JSON.stringify({
        event: "database.required_schema_verified",
        migrationJournalPresent: result.migrationJournalPresent,
        migrationCount: result.migrationCount,
        tables: result.presentTables,
      })}\n`,
    );
  } catch (error) {
    const result = error instanceof RequiredSchemaMissingError ? error.result : undefined;
    process.stderr.write(
      `${JSON.stringify({
        event: "database.required_schema_missing",
        migrationJournalPresent: result?.migrationJournalPresent ?? false,
        migrationCount: result?.migrationCount ?? 0,
        missingTables: result?.missingTables ?? [...REQUIRED_INBOX_TABLES],
      })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void main();
}
