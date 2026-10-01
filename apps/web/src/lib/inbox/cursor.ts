import { z } from "zod";

const cursorPayloadSchema = z.object({
  at: z.string().datetime(),
  id: z.string().uuid(),
});

export interface InboxCursor {
  at: Date;
  id: string;
}

export function encodeInboxCursor(cursor: InboxCursor): string {
  return Buffer.from(JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id })).toString(
    "base64url",
  );
}

export function decodeInboxCursor(value: string | undefined): InboxCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return { at: new Date(parsed.at), id: parsed.id };
  } catch {
    return undefined;
  }
}
