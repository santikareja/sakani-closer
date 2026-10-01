import "server-only";

import { getWebEnv } from "@sakani/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { assertWorkspaceAccess, requireSessionValue } from "./access";
import { SESSION_COOKIE_NAME } from "./cookie";
import { getAuthRepository } from "./runtime";
import { readCurrentSession } from "./session-reader";
import type { CurrentSession } from "./types";

export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const env = getWebEnv();
  return readCurrentSession(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    env.AUTH_SECRET,
    getAuthRepository(),
  );
});

export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/dashboard");
  }
  return requireSessionValue(session);
}

export async function requireWorkspaceAccess(workspaceId: unknown): Promise<CurrentSession> {
  const session = await getCurrentSession();
  return assertWorkspaceAccess(session, workspaceId);
}

export { WorkspaceAccessError } from "./access";
