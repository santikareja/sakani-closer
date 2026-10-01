import { getWebEnv } from "@sakani/config";
import { NextResponse } from "next/server";

import { getSessionCookieOptions, SESSION_COOKIE_NAME, shouldUseSecureCookie } from "./cookie";
import { sealSessionCookie } from "./session-crypto";
import type { SessionMaterial } from "./types";

export function createAuthenticatedRedirect(
  applicationUrl: string,
  destination: string,
  session: SessionMaterial,
): NextResponse {
  const env = getWebEnv();
  const response = NextResponse.redirect(new URL(destination, applicationUrl), 303);
  const cookieValue = sealSessionCookie(
    {
      version: 1,
      workspaceId: session.workspaceId,
      token: session.token,
      expiresAt: session.expiresAt.getTime(),
    },
    env.AUTH_SECRET,
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    cookieValue,
    getSessionCookieOptions(session.expiresAt, shouldUseSecureCookie(env.NODE_ENV, env.APP_URL)),
  );
  return response;
}
