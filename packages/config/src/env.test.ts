import { describe, expect, it } from "vitest";

import {
  futureGatewayEnvSchema,
  futureWorkerEnvSchema,
  parseDatabaseEnv,
  parseWebEnv,
} from "./env";

const databaseOnlyEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/sakani",
};

const validWebEnv = {
  ...databaseOnlyEnv,
  NODE_ENV: "test",
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  REDIS_URL: "redis://:password@localhost:6379",
  AUTH_SECRET: "test-auth-secret-at-least-32-characters-long",
};

describe("service-specific environment validation", () => {
  it("parses database and seed configuration without AUTH_SECRET", () => {
    const env = parseDatabaseEnv(databaseOnlyEnv);

    expect(env).toEqual(databaseOnlyEnv);
  });

  it("rejects unsupported database connection protocols", () => {
    expect(() => parseDatabaseEnv({ DATABASE_URL: "https://example.com/db" })).toThrow(
      "DATABASE_URL",
    );
  });

  it("keeps AUTH_SECRET mandatory for the web authentication runtime", () => {
    expect(() => parseWebEnv(validWebEnv)).not.toThrow();
    expect(() => parseWebEnv({ ...validWebEnv, AUTH_SECRET: undefined })).toThrow("AUTH_SECRET");
    expect(() => parseWebEnv({ ...validWebEnv, AUTH_SECRET: "short" })).toThrow("AUTH_SECRET");
  });

  it("keeps future gateway and worker contracts separate from current runtimes", () => {
    expect(futureGatewayEnvSchema.safeParse({}).success).toBe(false);
    expect(futureWorkerEnvSchema.safeParse({}).success).toBe(false);
  });
});
