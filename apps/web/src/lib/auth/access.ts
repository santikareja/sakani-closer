import { requireWorkspaceContext } from "@sakani/database";

import type { CurrentSession } from "./types";

export class SessionRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "SessionRequiredError";
  }
}

export class WorkspaceAccessError extends Error {
  constructor() {
    super("Workspace access denied");
    this.name = "WorkspaceAccessError";
  }
}

export function requireSessionValue(session: CurrentSession | null): CurrentSession {
  if (!session) {
    throw new SessionRequiredError();
  }
  return session;
}

export function assertWorkspaceAccess(
  session: CurrentSession | null,
  workspaceId: unknown,
): CurrentSession {
  const context = requireWorkspaceContext(workspaceId);
  if (!session || session.workspaceId !== context.workspaceId) {
    throw new WorkspaceAccessError();
  }
  return session;
}
