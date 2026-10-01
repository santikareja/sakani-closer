import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

const workspaceIdSchema = z.string().uuid();

export interface WorkspaceContext {
  workspaceId: string;
}

export function requireWorkspaceContext(workspaceId: unknown): WorkspaceContext {
  return { workspaceId: workspaceIdSchema.parse(workspaceId) };
}

export function scopeToWorkspace(column: PgColumn, context: WorkspaceContext): SQL {
  return eq(column, context.workspaceId);
}
