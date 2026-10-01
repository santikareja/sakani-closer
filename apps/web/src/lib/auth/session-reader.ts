import { requireWorkspaceContext } from "@sakani/database";

import { hashSessionToken, openSessionCookie } from "./session-crypto";
import type { AuthRepository, CurrentSession } from "./types";

export async function readCurrentSession(
  cookieValue: string | undefined,
  secret: string,
  repository: AuthRepository,
  now = new Date(),
): Promise<CurrentSession | null> {
  if (!cookieValue) {
    return null;
  }

  const payload = openSessionCookie(cookieValue, secret);
  if (!payload || payload.expiresAt <= now.getTime()) {
    return null;
  }

  return repository.findSession(
    requireWorkspaceContext(payload.workspaceId),
    hashSessionToken(payload.token),
    now,
  );
}

export async function revokeCookieSession(
  cookieValue: string | undefined,
  secret: string,
  repository: AuthRepository,
  now = new Date(),
): Promise<boolean> {
  if (!cookieValue) {
    return false;
  }

  const payload = openSessionCookie(cookieValue, secret);
  if (!payload) {
    return false;
  }

  return repository.revokeSessionAndAudit(
    requireWorkspaceContext(payload.workspaceId),
    hashSessionToken(payload.token),
    now,
  );
}
