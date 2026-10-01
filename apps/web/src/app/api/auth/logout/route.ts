import { getServerEnv } from "@sakani/config";
import { NextResponse, type NextRequest } from "next/server";

import {
  getExpiredSessionCookieOptions,
  SESSION_COOKIE_NAME,
  shouldUseSecureCookie,
} from "../../../../lib/auth/cookie";
import { isSameOriginMutation } from "../../../../lib/auth/http";
import { getAuthRepository } from "../../../../lib/auth/runtime";
import { revokeCookieSession } from "../../../../lib/auth/session-reader";
import { createSafeErrorResponse } from "../../../../lib/safe-error";

export async function POST(request: NextRequest): Promise<Response> {
  const env = getServerEnv();
  if (!isSameOriginMutation(request, env.APP_URL)) {
    return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 403 });
  }

  try {
    await revokeCookieSession(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      env.AUTH_SECRET,
      getAuthRepository(),
    );
    const response = NextResponse.redirect(new URL("/login?status=logged-out", env.APP_URL), 303);
    response.cookies.set(
      SESSION_COOKIE_NAME,
      "",
      getExpiredSessionCookieOptions(shouldUseSecureCookie(env.NODE_ENV, env.APP_URL)),
    );
    return response;
  } catch (error: unknown) {
    return createSafeErrorResponse(error, 503);
  }
}
