import { z } from "zod";
import { requireWorkspaceContext, type WorkspaceContext } from "@sakani/database";
import { DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID } from "@sakani/shared";

import { isSameOriginMutation } from "../auth/http";
import type { CurrentSession } from "../auth/types";
import {
  GatewayRequestError,
  type GatewayQrResponse,
  type WhatsAppStatusResponse,
} from "./contracts";
import type { WhatsAppGatewayClient } from "./gateway-client";
import type { GatewayStatusResponse } from "./gateway-internal-contracts";

const emptyBodySchema = z.object({}).strict();

export interface WhatsAppRouteDependencies {
  applicationUrl: string;
  getSession(): Promise<CurrentSession | null>;
  gateway: WhatsAppGatewayClient;
  accountRegistry: {
    ensureAccount(context: WorkspaceContext): Promise<{ id: string }>;
    getAccount(context: WorkspaceContext): Promise<{
      id: string;
      gatewayAccountId: string;
      status: string;
      phoneNumberMasked: string | null;
      lastConnectedAt: Date | null;
      lastDisconnectedAt: Date | null;
      updatedAt: Date;
    } | null>;
    markConnecting(context: WorkspaceContext, accountId: string): Promise<void>;
    markDisconnected(context: WorkspaceContext, accountId: string): Promise<void>;
  };
}

type DurableAccount = Awaited<
  ReturnType<WhatsAppRouteDependencies["accountRegistry"]["getAccount"]>
>;

export function createPublicWhatsAppStatus(
  gateway: GatewayStatusResponse | null,
  account: DurableAccount,
  workspaceId: string,
): WhatsAppStatusResponse {
  const rawState = gateway?.connection.state;
  const connectionState: WhatsAppStatusResponse["connection"]["state"] =
    rawState === "connected"
      ? "connected"
      : rawState === "connecting" || rawState === "qr_ready"
        ? "connecting"
        : rawState === "disconnected" ||
            rawState === "logged_out" ||
            rawState === "auth_error" ||
            rawState === "stopping"
          ? "disconnected"
          : "unknown";
  const bindingMatches =
    gateway?.binding.state === "bound" &&
    gateway.binding.workspaceId === workspaceId &&
    account?.id === gateway.binding.accountId;
  const accountStatus: WhatsAppStatusResponse["account"]["status"] =
    account?.status === "connected" ||
    account?.status === "connecting" ||
    account?.status === "disconnected"
      ? account.status
      : "unknown";

  return {
    connection: {
      state: connectionState,
      ...(rawState ? { detail: rawState } : {}),
      ...(gateway?.connection.updatedAt ? { updatedAt: gateway.connection.updatedAt } : {}),
    },
    binding: {
      state: gateway ? (bindingMatches ? "bound" : "unbound") : "unknown",
    },
    account: {
      status: accountStatus,
      ...(account?.gatewayAccountId === DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID
        ? { gatewayAccountId: DEFAULT_WHATSAPP_GATEWAY_ACCOUNT_ID }
        : {}),
      lastConnectedAt: account?.lastConnectedAt?.toISOString() ?? null,
      lastDisconnectedAt: account?.lastDisconnectedAt?.toISOString() ?? null,
      phoneNumberMasked: account?.phoneNumberMasked ?? null,
      updatedAt: account?.updatedAt.toISOString() ?? null,
    },
    history: gateway?.history ?? { capability: "unavailable" },
    diagnostics: {
      gateway: gateway ? "healthy" : "unavailable",
      lifecyclePersistence: gateway?.lifecyclePersistence.state ?? "unknown",
    },
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

function bindingBelongsToAccount(
  gateway: GatewayStatusResponse,
  workspaceId: string,
  accountId: string,
): boolean {
  return (
    gateway.binding.state === "unbound" ||
    (gateway.binding.workspaceId === workspaceId && gateway.binding.accountId === accountId)
  );
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
    const context = requireWorkspaceContext(session.workspaceId);
    const [gateway, account] = await Promise.all([
      dependencies.gateway.getStatus().catch(() => null),
      dependencies.accountRegistry.getAccount(context).catch(() => null),
    ]);
    return json(createPublicWhatsAppStatus(gateway, account, context.workspaceId));
  } catch {
    return json(createPublicWhatsAppStatus(null, null, session.workspaceId));
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
    const context = requireWorkspaceContext(session.workspaceId);
    if (action === "disconnect") {
      const account = await dependencies.accountRegistry.getAccount(context);
      const currentGateway = await dependencies.gateway.getStatus();
      if (
        currentGateway.binding.state === "bound" &&
        (!account || !bindingBelongsToAccount(currentGateway, context.workspaceId, account.id))
      ) {
        return json(
          { error: { code: "BINDING_CONFLICT", message: "Binding gateway tidak sesuai." } },
          409,
        );
      }
      const gateway = await dependencies.gateway.disconnect();
      if (account) await dependencies.accountRegistry.markDisconnected(context, account.id);
      const durableAccount = await dependencies.accountRegistry.getAccount(context);
      return json(createPublicWhatsAppStatus(gateway, durableAccount, context.workspaceId));
    }
    const currentGateway = await dependencies.gateway.getStatus();
    if (
      currentGateway.binding.state === "bound" &&
      currentGateway.binding.workspaceId !== context.workspaceId
    ) {
      return json(
        { error: { code: "BINDING_CONFLICT", message: "Binding gateway tidak sesuai." } },
        409,
      );
    }
    const account = await dependencies.accountRegistry.ensureAccount(context);
    const binding = { workspaceId: session.workspaceId, accountId: account.id };
    if (!bindingBelongsToAccount(currentGateway, context.workspaceId, account.id)) {
      return json(
        { error: { code: "BINDING_CONFLICT", message: "Binding gateway tidak sesuai." } },
        409,
      );
    }
    if (action === "refresh") {
      await dependencies.gateway.disconnect();
    }
    await dependencies.accountRegistry.markConnecting(context, account.id);
    let gateway: GatewayStatusResponse;
    try {
      gateway = await dependencies.gateway.connect(binding);
    } catch (error) {
      await dependencies.accountRegistry
        .markDisconnected(context, account.id)
        .catch(() => undefined);
      throw error;
    }
    const durableAccount = await dependencies.accountRegistry.getAccount(context);
    return json(createPublicWhatsAppStatus(gateway, durableAccount, context.workspaceId), 202);
  } catch (error) {
    return safeGatewayError(error);
  }
}

export type { GatewayQrResponse, WhatsAppStatusResponse };
