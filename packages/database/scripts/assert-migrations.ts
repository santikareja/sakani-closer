import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

interface JournalEntry {
  idx: number;
  tag: string;
}

export interface MigrationArtifactInspection {
  directory: string;
  sqlFiles: string[];
  snapshotFiles: string[];
  journalEntries: number;
}

function parseJournal(value: unknown): JournalEntry[] {
  if (!value || typeof value !== "object" || !("entries" in value)) {
    throw new Error("Migration journal is invalid");
  }
  const entries = value.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Migration journal has no entries");
  }
  return entries.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("idx" in entry) ||
      typeof entry.idx !== "number" ||
      !Number.isInteger(entry.idx) ||
      !("tag" in entry) ||
      typeof entry.tag !== "string" ||
      !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)
    ) {
      throw new Error("Migration journal contains an invalid entry");
    }
    return { idx: entry.idx, tag: entry.tag };
  });
}

export async function inspectMigrationDirectory(
  migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle"),
): Promise<MigrationArtifactInspection> {
  const directory = resolve(migrationDirectory);
  const metadataDirectory = resolve(directory, "meta");
  const journalPath = resolve(metadataDirectory, "_journal.json");

  const [directoryStats, entries, metadataEntries, journalText] = await Promise.all([
    stat(directory),
    readdir(directory, { withFileTypes: true }),
    readdir(metadataDirectory, { withFileTypes: true }),
    readFile(journalPath, "utf8"),
  ]);
  if (!directoryStats.isDirectory()) throw new Error("Migration path is not a directory");

  const sqlFiles = entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (sqlFiles.length === 0) throw new Error("No committed SQL migrations were found");

  const journal = parseJournal(JSON.parse(journalText) as unknown);
  const journalFiles = journal.map((entry) => `${entry.tag}.sql`);
  const missingSqlFiles = journalFiles.filter((file) => !sqlFiles.includes(file));
  if (missingSqlFiles.length > 0) {
    throw new Error(
      `Migration journal references missing SQL files: ${missingSqlFiles.join(", ")}`,
    );
  }
  const unjournaledSqlFiles = sqlFiles.filter((file) => !journalFiles.includes(file));
  if (unjournaledSqlFiles.length > 0) {
    throw new Error(
      `SQL migrations are missing from the journal: ${unjournaledSqlFiles.join(", ")}`,
    );
  }

  for (const file of sqlFiles) {
    const contents = await readFile(resolve(directory, file), "utf8");
    if (contents.trim().length === 0) throw new Error(`Migration file is empty: ${file}`);
  }

  const snapshotFiles = metadataEntries
    .filter((entry) => entry.isFile() && /^\d{4}_snapshot\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (snapshotFiles.length === 0) throw new Error("No Drizzle migration snapshots were found");
  const expectedSnapshots = journal.map(
    (entry) => `${String(entry.idx).padStart(4, "0")}_snapshot.json`,
  );
  const missingSnapshots = expectedSnapshots.filter((file) => !snapshotFiles.includes(file));
  if (missingSnapshots.length > 0) {
    throw new Error(`Migration metadata is incomplete: ${missingSnapshots.join(", ")}`);
  }

  return { directory, sqlFiles, snapshotFiles, journalEntries: journal.length };
}

async function main(): Promise<void> {
  const result = await inspectMigrationDirectory();
  process.stdout.write(
    `${JSON.stringify({
      event: "database.migration_artifacts_verified",
      migrationCount: result.sqlFiles.length,
      journalEntries: result.journalEntries,
      migrations: result.sqlFiles,
    })}\n`,
  );
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        event: "database.migration_artifacts_invalid",
        error: error instanceof Error ? error.message : "Unknown migration artifact error",
      })}\n`,
    );
    process.exitCode = 1;
  });
}
