export const SESSION_COOKIE_NAME = "sakani_session";

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  expires: Date;
  priority: "high";
  maxAge?: number;
}

export function shouldUseSecureCookie(nodeEnvironment: string, applicationUrl: string): boolean {
  return nodeEnvironment === "production" || new URL(applicationUrl).protocol === "https:";
}

export function getSessionCookieOptions(
  expiresAt: Date,
  production: boolean,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    expires: expiresAt,
    priority: "high",
  };
}

export function getExpiredSessionCookieOptions(production: boolean): SessionCookieOptions {
  return {
    ...getSessionCookieOptions(new Date(0), production),
    maxAge: 0,
  };
}
