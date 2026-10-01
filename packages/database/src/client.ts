import { getServerEnv } from "@sakani/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

export function createDatabasePool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "sakani-closer",
  });
}

export function getDatabasePool(): Pool {
  pool ??= createDatabasePool(getServerEnv().DATABASE_URL);
  return pool;
}

export function getDatabase(): Database {
  database ??= drizzle(getDatabasePool(), { schema });
  return database;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = undefined;
  database = undefined;
}
