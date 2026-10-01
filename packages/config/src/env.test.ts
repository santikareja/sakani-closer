import { describe, expect, it } from "vitest";

import { futureWorkerEnvSchema, parseGatewayEnv, parseDatabaseEnv, parseWebEnv } from "./env";

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

const validGatewayEnv = {
  NODE_ENV: "test",
  WA_GATEWAY_PORT: "3001",
  WA_AUTH_DATA_DIR: "./wa-auth-test",
  WA_LOG_LEVEL: "silent",
  SESSION_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  INTERNAL_SERVICE_TOKEN: "gateway-test-token-at-least-32-characters",
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

  it("keeps gateway configuration independent from database, Redis, and web auth", () => {
    const env = parseGatewayEnv(validGatewayEnv);

    expect(env.WA_GATEWAY_PORT).toBe(3001);
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("REDIS_URL");
    expect(env).not.toHaveProperty("AUTH_SECRET");
  });

  it("rejects weak gateway secrets and invalid ports", () => {
    expect(() => parseGatewayEnv({ ...validGatewayEnv, INTERNAL_SERVICE_TOKEN: "short" })).toThrow(
      "INTERNAL_SERVICE_TOKEN",
    );
    expect(() =>
      parseGatewayEnv({ ...validGatewayEnv, SESSION_ENCRYPTION_KEY: "not-a-32-byte-key" }),
    ).toThrow("SESSION_ENCRYPTION_KEY");
    expect(() => parseGatewayEnv({ ...validGatewayEnv, WA_GATEWAY_PORT: "70000" })).toThrow(
      "WA_GATEWAY_PORT",
    );
  });

  it("keeps future worker contracts separate from current runtimes", () => {
    expect(futureWorkerEnvSchema.safeParse({}).success).toBe(false);
  });
});
