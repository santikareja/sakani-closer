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

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production", "test"]).default("local"),
  APP_URL: z.string().url(),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  AUTH_SECRET: z.string().min(32),
  HEALTHCHECK_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1_500),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export const laterPhaseEnvSchema = z.object({
  SESSION_ENCRYPTION_KEY: z.string().min(32),
  API_ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  WA_GATEWAY_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type LaterPhaseEnv = z.infer<typeof laterPhaseEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function parseServerEnv(input: NodeJS.ProcessEnv | Record<string, unknown>): ServerEnv {
  return serverEnvSchema.parse(input);
}

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}

export function resetServerEnvForTests(): void {
  cachedEnv = undefined;
}
