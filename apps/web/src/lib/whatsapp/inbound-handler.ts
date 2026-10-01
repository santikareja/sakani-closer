import { createHash, timingSafeEqual } from "node:crypto";

import { requireWorkspaceContext } from "@sakani/database";

import { whatsappInboundEventSchema } from "./inbound-contracts";
import { InboundAccountNotFoundError, type InboundRepository } from "./inbound-types";

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
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export interface InboundHandlerDependencies {
  internalServiceToken: string;
  repository: InboundRepository;
  logger: {
    info(bindings: Record<string, unknown>, message?: string): void;
    error(bindings: Record<string, unknown>, message?: string): void;
  };
}

export async function handleWhatsAppInboundEvent(
  request: Request,
  dependencies: InboundHandlerDependencies,
): Promise<Response> {
  if (!hasValidToken(request, dependencies.internalServiceToken)) {
    return json(
      { error: { code: "UNAUTHORIZED", message: "Token layanan internal tidak valid." } },
      401,
    );
  }

  let parsed: ReturnType<typeof whatsappInboundEventSchema.safeParse>;
  try {
    parsed = whatsappInboundEventSchema.safeParse(await request.json());
  } catch {
    return json(
      { error: { code: "INVALID_REQUEST", message: "Payload inbound tidak valid." } },
      400,
    );
  }
  if (!parsed.success) {
    return json(
      { error: { code: "INVALID_REQUEST", message: "Payload inbound tidak valid." } },
      400,
    );
  }

  const { binding, message } = parsed.data;
  const context = requireWorkspaceContext(binding.workspaceId);
  try {
    if (message.outcome === "ignored") {
      await dependencies.repository.recordIgnored(context, binding.accountId, message);
      dependencies.logger.info(
        {
          event: "wa.message.ignored",
          workspaceId: context.workspaceId,
          accountId: binding.accountId,
          reason: message.reason,
          providerMessageIdHash: message.providerMessageIdHash,
        },
        "Event WhatsApp diabaikan sesuai kebijakan receive-only",
      );
      return json({ status: "ignored" }, 200);
    }

    const result = await dependencies.repository.ingestAccepted(
      context,
      binding.accountId,
      message,
    );
    dependencies.logger.info(
      {
        event: result === "created" ? "wa.message.received" : "wa.message.duplicate",
        workspaceId: context.workspaceId,
        accountId: binding.accountId,
        providerMessageIdHash: message.providerMessageIdHash,
        messageType: message.messageType,
      },
      result === "created"
        ? "Pesan WhatsApp inbound disimpan"
        : "Pesan WhatsApp duplikat diabaikan",
    );
    return json({ status: result }, result === "created" ? 202 : 200);
  } catch (error) {
    if (error instanceof InboundAccountNotFoundError) {
      return json(
        { error: { code: "ACCOUNT_BINDING_NOT_FOUND", message: "Binding akun tidak valid." } },
        404,
      );
    }
    dependencies.logger.error(
      {
        event: "wa.message.ingest_error",
        workspaceId: context.workspaceId,
        accountId: binding.accountId,
        providerMessageIdHash: message.providerMessageIdHash,
      },
      "Pesan WhatsApp inbound gagal disimpan",
    );
    return json(
      { error: { code: "INTERNAL_ERROR", message: "Pesan inbound belum dapat disimpan." } },
      500,
    );
  }
}
