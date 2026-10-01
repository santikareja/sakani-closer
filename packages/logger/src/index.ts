import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";

import pino, { type Logger, type LoggerOptions } from "pino";

const REDACTED_PATHS = [
  "password",
  "passwordHash",
  "password_hash",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "req.headers.authorization",
  "headers.authorization",
  "whatsappAuthState",
  "session",
  "sessionToken",
  "session_token",
  "cookie",
  "req.headers.cookie",
  "headers.cookie",
  "authSecret",
  "AUTH_SECRET",
  "message.content",
] as const;

export interface LoggerContext {
  correlationId?: string;
  jobId?: string;
  workspaceId?: string;
  service?: string;
}

export interface CreateLoggerOptions {
  level?: LoggerOptions["level"];
  destination?: Writable;
  base?: Record<string, unknown>;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: options.base ?? null,
    redact: {
      paths: [...REDACTED_PATHS],
      censor: "[REDACTED]",
    },
  };

  return options.destination ? pino(loggerOptions, options.destination) : pino(loggerOptions);
}

export function withLoggerContext(logger: Logger, context: LoggerContext): Logger {
  return logger.child({
    correlationId: context.correlationId ?? randomUUID(),
    ...(context.jobId ? { jobId: context.jobId } : {}),
    ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
    ...(context.service ? { service: context.service } : {}),
  });
}

export { REDACTED_PATHS };
