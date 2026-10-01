import { describe, expect, it, vi } from "vitest";

import { createHealthReport, healthReportResponse } from "./health";

const env = {
  APP_ENV: "test" as const,
  NODE_ENV: "test" as const,
  HEALTHCHECK_TIMEOUT_MS: 100,
};

describe("health endpoint", () => {
  it("returns 200 when all mandatory dependencies are healthy", async () => {
    const report = await createHealthReport({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockResolvedValue(undefined),
      env,
      now: () => new Date("2026-09-30T00:00:00.000Z"),
    });
    const response = healthReportResponse(report);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      database: { status: "ok" },
      redis: { status: "ok" },
      environment: { app: "test", node: "test" },
      timestamp: "2026-09-30T00:00:00.000Z",
    });
  });

  it("returns 503 without leaking a dependency error", async () => {
    const secret = "redis://:secret@private-host:6379";
    const report = await createHealthReport({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockRejectedValue(new Error(secret)),
      env,
    });
    const response = healthReportResponse(report);
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(secret);
    expect(body).not.toContain("private-host");
    expect(body).toContain('"redis":{"status":"error"');
  });
});
