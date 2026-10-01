import { requireWorkspaceContext } from "@sakani/database";
import { z } from "zod";

import type { CurrentSession } from "../auth/types";
import { decodeInboxCursor } from "./cursor";
import type { InboxRepository } from "./repository";

const listQuerySchema = z.object({
  cursor: z
    .string()
    .min(1)
    .max(512)
    .refine((value) => decodeInboxCursor(value) !== undefined)
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const conversationIdSchema = z.string().uuid();

export interface InboxRouteDependencies {
  getSession(): Promise<CurrentSession | null>;
  repository: InboxRepository;
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

function parseQuery(request: Request): z.infer<typeof listQuerySchema> | undefined {
  const url = new URL(request.url);
  const input = Object.fromEntries(url.searchParams);
  const parsed = listQuerySchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}

export async function handleConversationList(
  request: Request,
  dependencies: InboxRouteDependencies,
): Promise<Response> {
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  const query = parseQuery(request);
  if (!query) {
    return json({ error: { code: "INVALID_REQUEST", message: "Filter inbox tidak valid." } }, 400);
  }
  const context = requireWorkspaceContext(session.workspaceId);
  const result = await dependencies.repository.listConversations(context, query);
  await dependencies.repository.recordInboxViewed(context, session.userId);
  return json(result);
}

export async function handleConversationDetail(
  request: Request,
  conversationId: string,
  dependencies: InboxRouteDependencies,
): Promise<Response> {
  const session = await dependencies.getSession();
  if (!session) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sesi owner diperlukan." } }, 401);
  }
  const id = conversationIdSchema.safeParse(conversationId);
  const query = parseQuery(request);
  if (!id.success || !query) {
    return json(
      { error: { code: "INVALID_REQUEST", message: "Permintaan inbox tidak valid." } },
      400,
    );
  }
  const result = await dependencies.repository.getConversation(
    requireWorkspaceContext(session.workspaceId),
    id.data,
    query,
  );
  return result
    ? json(result)
    : json({ error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } }, 404);
}
