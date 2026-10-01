import type { IncomingMessage, ServerResponse } from "node:http";

import { z } from "zod";

import type { ConnectionManager } from "../connection/manager.js";
import type { GatewayLogger } from "../connection/types.js";
import { createHealthPayload } from "../health/index.js";
import type { QrManager } from "../qr/qr-manager.js";
import { hasValidInternalToken } from "./auth.js";

const emptyBodySchema = z.object({}).strict();
const emptyQuerySchema = z.object({}).strict();

class InvalidRequestError extends Error {}

class FixedWindowRateLimiter {
  private count = 0;
  private windowStartedAt = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(): boolean {
    const current = this.now();
    if (current - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = current;
      this.count = 0;
    }
    if (this.count >= this.limit) return false;
    this.count += 1;
    return true;
  }
}

export interface InternalRouteDependencies {
  manager: ConnectionManager;
  qrManager: QrManager;
  internalServiceToken: string;
  logger: GatewayLogger;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 1_024) throw new InvalidRequestError("request_body_too_large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function parseQuery(url: URL): void {
  emptyQuerySchema.parse(Object.fromEntries(url.searchParams));
}

export function createInternalRequestHandler(dependencies: InternalRouteDependencies) {
  const connectRateLimit = new FixedWindowRateLimiter(5, 60_000);
  const qrRateLimit = new FixedWindowRateLimiter(30, 60_000);

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://wa-gateway.internal");

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        parseQuery(url);
        sendJson(response, 200, createHealthPayload(dependencies.manager.getStatus()));
        return;
      }

      if (url.pathname.startsWith("/internal/")) {
        if (!hasValidInternalToken(request, dependencies.internalServiceToken)) {
          sendJson(response, 401, {
            error: { code: "UNAUTHORIZED", message: "Token layanan internal tidak valid." },
          });
          return;
        }

        if (request.method === "GET" && url.pathname === "/internal/status") {
          parseQuery(url);
          sendJson(response, 200, { connection: dependencies.manager.getStatus() });
          return;
        }

        if (request.method === "POST" && url.pathname === "/internal/connect") {
          if (!connectRateLimit.consume()) {
            sendJson(response, 429, {
              error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan koneksi." },
            });
            return;
          }
          emptyBodySchema.parse(await parseJsonBody(request));
          const connection = await dependencies.manager.connect();
          sendJson(response, 202, { connection });
          return;
        }

        if (request.method === "POST" && url.pathname === "/internal/disconnect") {
          emptyBodySchema.parse(await parseJsonBody(request));
          const connection = await dependencies.manager.disconnect();
          sendJson(response, 200, { connection });
          return;
        }

        if (request.method === "GET" && url.pathname === "/internal/qr") {
          if (!qrRateLimit.consume()) {
            sendJson(response, 429, {
              error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan QR." },
            });
            return;
          }
          parseQuery(url);
          const qr = dependencies.qrManager.get();
          if (!qr) {
            sendJson(response, 404, {
              error: {
                code: "QR_NOT_AVAILABLE",
                message: "QR belum tersedia atau sudah kedaluwarsa.",
              },
            });
            return;
          }
          sendJson(response, 200, qr);
          return;
        }
      }

      sendJson(response, 404, {
        error: { code: "NOT_FOUND", message: "Endpoint tidak ditemukan." },
      });
    } catch (error) {
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        error instanceof InvalidRequestError
      ) {
        sendJson(response, 400, {
          error: { code: "INVALID_REQUEST", message: "Permintaan tidak valid." },
        });
        return;
      }
      dependencies.logger.error(
        { event: "wa.internal.unhandled_error" },
        "Permintaan internal gateway gagal",
      );
      sendJson(response, 500, {
        error: { code: "INTERNAL_ERROR", message: "Layanan gateway mengalami gangguan." },
      });
    }
  };
}
