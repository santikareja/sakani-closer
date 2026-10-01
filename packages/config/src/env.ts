import { z } from "zod";

const postgresUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "DATABASE_URL must use the postgresql:// or postgres:// protocol",
  });

const redisUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("redis://") || value.startsWith("rediss://"), {
    message: "REDIS_URL must use the redis:// or rediss:// protocol",
  });

const runtimeModeShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production", "test"]).default("local"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
};

export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
});

export const webEnvSchema = databaseEnvSchema.extend({
  ...runtimeModeShape,
  APP_URL: z.string().url(),
  REDIS_URL: redisUrl,
  AUTH_SECRET: z.string().min(32),
  WA_GATEWAY_URL: z.string().url(),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  HEALTHCHECK_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1_500),
});

export const gatewayEnvSchema = z.object({
  NODE_ENV: runtimeModeShape.NODE_ENV,
  WA_GATEWAY_PORT: z.coerce.number().int().min(1).max(65_535).default(3_001),
  WA_AUTH_DATA_DIR: z.string().trim().min(1).default("./wa-auth"),
  WA_LOG_LEVEL: runtimeModeShape.LOG_LEVEL,
  SESSION_ENCRYPTION_KEY: z.string().min(32).max(1_024),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  WA_INGEST_URL: z.string().url(),
});

export const futureWorkerEnvSchema = databaseEnvSchema.extend({
  ...runtimeModeShape,
  REDIS_URL: redisUrl,
  API_ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  WA_GATEWAY_URL: z.string().url(),
  AI_DEFAULT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  RAG_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.72),
  FOLLOWUP_TIMEZONE: z.string().min(1).default("Asia/Jakarta"),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;
export type FutureWorkerEnv = z.infer<typeof futureWorkerEnvSchema>;

let cachedDatabaseEnv: DatabaseEnv | undefined;
let cachedWebEnv: WebEnv | undefined;
let cachedGatewayEnv: GatewayEnv | undefined;

export function parseDatabaseEnv(input: NodeJS.ProcessEnv | Record<string, unknown>): DatabaseEnv {
  return databaseEnvSchema.parse(input);
}

export function parseWebEnv(input: NodeJS.ProcessEnv | Record<string, unknown>): WebEnv {
  return webEnvSchema.parse(input);
}

export function parseGatewayEnv(input: NodeJS.ProcessEnv | Record<string, unknown>): GatewayEnv {
  return gatewayEnvSchema.parse(input);
}

export function getDatabaseEnv(): DatabaseEnv {
  cachedDatabaseEnv ??= parseDatabaseEnv(process.env);
  return cachedDatabaseEnv;
}

export function getWebEnv(): WebEnv {
  cachedWebEnv ??= parseWebEnv(process.env);
  return cachedWebEnv;
}

export function getGatewayEnv(): GatewayEnv {
  cachedGatewayEnv ??= parseGatewayEnv(process.env);
  return cachedGatewayEnv;
}

export function resetEnvForTests(): void {
  cachedDatabaseEnv = undefined;
  cachedWebEnv = undefined;
  cachedGatewayEnv = undefined;
}
