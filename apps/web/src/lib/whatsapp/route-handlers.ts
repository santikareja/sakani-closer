import { z } from "zod";
import type { WorkspaceContext } from "@sakani/database";

import { isSameOriginMutation } from "../auth/http";
import type { CurrentSession } from "../auth/types";
import {
  GatewayRequestError,
  type GatewayQrResponse,
  type GatewayStatusResponse,
} from "./contracts";
import type { WhatsAppGatewayClient } from "./gateway-client";

const emptyBodySchema = z.object({}).strict();

export interface WhatsAppRouteDependencies {
  applicationUrl: string;
  getSession(): Promise<CurrentSession | null>;
  gateway: WhatsAppGatewayClient;
  accountRegistry: {
    ensureAccount(context: WorkspaceContext): Promise<{ id: string }>;
  };
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

export async function handleWhatsAppStatus(
  request: Request,
  dependencies: WhatsAppRouteDependencies,
): Promise<Response> {
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  if (session.role !== "owner") {
    return json({ error: { code: "FORBIDDEN", message: "Akses owner diperlukan." } }, 403);
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
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  if (session.role !== "owner") {
    return json({ error: { code: "FORBIDDEN", message: "Akses owner diperlukan." } }, 403);
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

export async function handleWhatsAppMutation(
  request: Request,
  dependencies: WhatsAppRouteDependencies,
  action: "connect" | "disconnect" | "refresh",
): Promise<Response> {
  if (!isSameOriginMutation(request, dependencies.applicationUrl)) {
    return json({ error: { code: "FORBIDDEN", message: "Origin permintaan tidak valid." } }, 403);
  }
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  if (session.role !== "owner") {
    return json({ error: { code: "FORBIDDEN", message: "Akses owner diperlukan." } }, 403);
  }

  try {
    const body = await request.json();
    emptyBodySchema.parse(body);
  } catch {
    return json({ error: { code: "INVALID_REQUEST", message: "Permintaan tidak valid." } }, 400);
  }

  try {
    if (action === "disconnect") {
      return json(await dependencies.gateway.disconnect());
    }
    const account = await dependencies.accountRegistry.ensureAccount({
      workspaceId: session.workspaceId,
    });
    const binding = { workspaceId: session.workspaceId, accountId: account.id };
    if (action === "refresh") {
      await dependencies.gateway.disconnect();
    }
    return json(await dependencies.gateway.connect(binding), 202);
  } catch (error) {
    return safeGatewayError(error);
  }
}

export type { GatewayQrResponse, GatewayStatusResponse };
