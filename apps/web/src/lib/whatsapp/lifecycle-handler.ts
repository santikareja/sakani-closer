import { createHash, timingSafeEqual } from "node:crypto";

import { requireWorkspaceContext, type WorkspaceContext } from "@sakani/database";

import { whatsappLifecycleEventSchema } from "./lifecycle-contracts";
import { InboundAccountNotFoundError } from "./inbound-types";

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function hasValidToken(request: Request, expectedToken: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return timingSafeEqual(tokenDigest(authorization.slice(7)), tokenDigest(expectedToken));
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export interface LifecycleRepository {
  persistLifecycle(
    context: WorkspaceContext,
    accountId: string,
    event: {
      state: "connected" | "disconnected";
      phoneNumberMasked?: string | undefined;
    },
  ): Promise<void>;
}

export interface LifecycleHandlerDependencies {
  internalServiceToken: string;
  repository: LifecycleRepository;
  logger: {
    info(bindings: Record<string, unknown>, message?: string): void;
    error(bindings: Record<string, unknown>, message?: string): void;
  };
}

export async function handleWhatsAppLifecycleEvent(
  request: Request,
  dependencies: LifecycleHandlerDependencies,
): Promise<Response> {
  if (!hasValidToken(request, dependencies.internalServiceToken)) {
    return json({ status: "rejected", error: { code: "UNAUTHORIZED" } }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ status: "rejected", error: { code: "INVALID_REQUEST" } }, 400);
  }
  const parsed = whatsappLifecycleEventSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ status: "rejected", error: { code: "INVALID_REQUEST" } }, 400);
  }

  const { binding, correlationId, state, phoneNumberMasked } = parsed.data;
  try {
    await dependencies.repository.persistLifecycle(
      requireWorkspaceContext(binding.workspaceId),
      binding.accountId,
      { state, phoneNumberMasked },
    );
    dependencies.logger.info(
      { event: `wa.account.lifecycle.${state}`, correlationId },
      "Lifecycle akun WhatsApp diperbarui",
    );
    return json({ status: "accepted" }, 202);
  } catch (error) {
    if (error instanceof InboundAccountNotFoundError) {
      return json({ status: "rejected", error: { code: "ACCOUNT_BINDING_NOT_FOUND" } }, 404);
    }
    dependencies.logger.error(
      { event: "wa.account.lifecycle.persistence_failed", correlationId, lifecycleState: state },
      "Lifecycle akun WhatsApp gagal diperbarui",
    );
    return json({ status: "rejected", error: { code: "INTERNAL_ERROR" } }, 500);
  }
}
