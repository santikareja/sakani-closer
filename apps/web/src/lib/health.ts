import { getWebEnv, type WebEnv } from "@sakani/config";
import { checkDatabaseConnection, getDatabasePool } from "@sakani/database";
import type { ServiceStatus } from "@sakani/shared";
import { NextResponse } from "next/server";

import { checkRedisConnection, getRedisClient } from "./redis";

export interface HealthReport {
  status: "ok" | "error";
  app: ServiceStatus;
  database: ServiceStatus;
  redis: ServiceStatus;
  environment: {
    app: WebEnv["APP_ENV"];
    node: WebEnv["NODE_ENV"];
  };
  timestamp: string;
}

export interface HealthDependencies {
  checkDatabase: () => Promise<void>;
  checkRedis: () => Promise<void>;
  env: Pick<WebEnv, "APP_ENV" | "NODE_ENV" | "HEALTHCHECK_TIMEOUT_MS">;
  now?: () => Date;
}

async function timedCheck(check: () => Promise<void>, timeoutMs: number): Promise<ServiceStatus> {
  const startedAt = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Dependency health check timed out")),
          timeoutMs,
        );
      }),
    ]);
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "error", latencyMs: Math.round(performance.now() - startedAt) };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function createHealthReport(dependencies: HealthDependencies): Promise<HealthReport> {
  const [database, redis] = await Promise.all([
    timedCheck(dependencies.checkDatabase, dependencies.env.HEALTHCHECK_TIMEOUT_MS),
    timedCheck(dependencies.checkRedis, dependencies.env.HEALTHCHECK_TIMEOUT_MS),
  ]);
  const healthy = database.status === "ok" && redis.status === "ok";

  return {
    status: healthy ? "ok" : "error",
    app: { status: "ok", latencyMs: 0 },
    database,
    redis,
    environment: {
      app: dependencies.env.APP_ENV,
      node: dependencies.env.NODE_ENV,
    },
    timestamp: (dependencies.now ?? (() => new Date()))().toISOString(),
  };
}

export function healthReportResponse(report: HealthReport): NextResponse<HealthReport> {
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function getLiveHealthReport(): Promise<HealthReport> {
  const env = getWebEnv();
  return createHealthReport({
    checkDatabase: () => checkDatabaseConnection(getDatabasePool()),
    checkRedis: () => checkRedisConnection(getRedisClient(env.REDIS_URL)),
    env,
  });
}
