import { describe, expect, it } from "vitest";

import { laterPhaseEnvSchema, parseServerEnv } from "./env";

const validEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:password@localhost:5432/sakani",
  REDIS_URL: "redis://:password@localhost:6379",
  AUTH_SECRET: "test-auth-secret-at-least-32-characters-long",
};

describe("environment validation", () => {
  it("parses the environment required by Phase 0", () => {
    const env = parseServerEnv(validEnv);

    expect(env.APP_ENV).toBe("test");
    expect(env.HEALTHCHECK_TIMEOUT_MS).toBe(1_500);
  });

  it("rejects unsupported connection protocols", () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: "https://example.com/db" })).toThrow(
      "DATABASE_URL",
    );
  });

  it("requires the Phase 1 authentication secret", () => {
    expect(() => parseServerEnv(validEnv)).not.toThrow();
    expect(() => parseServerEnv({ ...validEnv, AUTH_SECRET: "short" })).toThrow("AUTH_SECRET");
    expect(laterPhaseEnvSchema.safeParse({}).success).toBe(false);
  });
});
