import { z } from "zod";

import { isSameOriginMutation } from "../auth/http";
import {
  GatewayRequestError,
  type GatewayQrResponse,
  type GatewayStatusResponse,
} from "./contracts";
import type { WhatsAppGatewayClient } from "./gateway-client";

const emptyBodySchema = z.object({}).strict();

export interface WhatsAppRouteDependencies {
  applicationUrl: string;
  getSession(): Promise<unknown | null>;
  gateway: WhatsAppGatewayClient;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeGatewayError(error: unknown): Response {
  if (error instanceof GatewayRequestError) {
    if (error.code === "QR_NOT_AVAILABLE") {
      return json(
        { error: { code: error.code, message: "QR belum tersedia atau sudah kedaluwarsa." } },
        404,
      );
    }
    if (error.code === "RATE_LIMITED") {
      return json(
        { error: { code: error.code, message: "Terlalu banyak permintaan. Coba lagi nanti." } },
        429,
      );
    }
  }

  return json(
    { error: { code: "GATEWAY_UNAVAILABLE", message: "Gateway WhatsApp belum dapat dihubungi." } },
    503,
  );
}

function hasEmptyQuery(request: Request): boolean {
  return new URL(request.url).searchParams.size === 0;
}

async function hasSession(dependencies: WhatsAppRouteDependencies): Promise<boolean> {
  return (await dependencies.getSession()) !== null;
}

export async function handleWhatsAppStatus(
  request: Request,
  dependencies: WhatsAppRouteDependencies,
): Promise<Response> {
  if (!(await hasSession(dependencies))) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  if (!hasEmptyQuery(request)) {
    return json({ error: { code: "INVALID_REQUEST", message: "Permintaan tidak valid." } }, 400);
  }

  try {
    return json(await dependencies.gateway.getStatus());
  } catch (error) {
    return safeGatewayError(error);
  }
}

export async function handleWhatsAppQr(
  request: Request,
  dependencies: WhatsAppRouteDependencies,
): Promise<Response> {
  if (!(await hasSession(dependencies))) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  if (!hasEmptyQuery(request)) {
    return json({ error: { code: "INVALID_REQUEST", message: "Permintaan tidak valid." } }, 400);
  }

  try {
    return json(await dependencies.gateway.getQr());
  } catch (error) {
    return safeGatewayError(error);
  }
}

type MutationAction =
  | (() => Promise<GatewayStatusResponse>)
  | (() => Promise<{ connection: GatewayStatusResponse["connection"] }>);

export async function handleWhatsAppMutation(
  request: Request,
  dependencies: WhatsAppRouteDependencies,
  action: "connect" | "disconnect" | "refresh",
): Promise<Response> {
  if (!isSameOriginMutation(request, dependencies.applicationUrl)) {
    return json({ error: { code: "FORBIDDEN", message: "Origin permintaan tidak valid." } }, 403);
  }
  if (!(await hasSession(dependencies))) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }

  try {
    const body = await request.json();
    emptyBodySchema.parse(body);
  } catch {
    return json({ error: { code: "INVALID_REQUEST", message: "Permintaan tidak valid." } }, 400);
  }

  const operations: Record<typeof action, MutationAction> = {
    connect: () => dependencies.gateway.connect(),
    disconnect: () => dependencies.gateway.disconnect(),
    refresh: async () => {
      await dependencies.gateway.disconnect();
      return dependencies.gateway.connect();
    },
  };

  try {
    return json(
      await operations[action](),
      action === "connect" || action === "refresh" ? 202 : 200,
    );
  } catch (error) {
    return safeGatewayError(error);
  }
}

export type { GatewayQrResponse, GatewayStatusResponse };
