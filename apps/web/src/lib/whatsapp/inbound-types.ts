import type { WorkspaceContext } from "@sakani/database";
import type { AcceptedInboundMessage, IgnoredInboundMessage } from "@sakani/shared";

export class InboundAccountNotFoundError extends Error {
  constructor() {
    super("Inbound WhatsApp account binding was not found");
    this.name = "InboundAccountNotFoundError";
  }
}

export interface InboundRepository {
  ensureAccount(context: WorkspaceContext): Promise<{ id: string }>;
  ingestAccepted(
    context: WorkspaceContext,
    accountId: string,
    message: AcceptedInboundMessage,
  ): Promise<"created" | "duplicate">;
  recordIgnored(
    context: WorkspaceContext,
    accountId: string,
    message: IgnoredInboundMessage,
  ): Promise<void>;
}
