import { getServerEnv } from "@sakani/config";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath, isSameOriginMutation } from "../../../../lib/auth/http";
import {
  consumeLoginAttempt,
  createLoginRateLimitKey,
  getRequestIpAddress,
} from "../../../../lib/auth/rate-limit";
import { createAuthenticatedRedirect } from "../../../../lib/auth/route-helpers";
import { getAuthService } from "../../../../lib/auth/runtime";
import { createSafeErrorResponse } from "../../../../lib/safe-error";
import { getRedisClient } from "../../../../lib/redis";

export async function POST(request: NextRequest): Promise<Response> {
  const env = getServerEnv();
  if (!isSameOriginMutation(request, env.APP_URL)) {
    return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "");
    const allowed = await consumeLoginAttempt(
      getRedisClient(env.REDIS_URL),
      createLoginRateLimitKey(getRequestIpAddress(request.headers), email),
    );
    if (!allowed) {
      return NextResponse.redirect(new URL("/daftar?error=rate-limited", env.APP_URL), 303);
    }

    const result = await getAuthService().register({
      displayName: String(formData.get("displayName") ?? ""),
      workspaceName: String(formData.get("workspaceName") ?? ""),
      email,
      password: String(formData.get("password") ?? ""),
    });
    if (!result.ok) {
      return NextResponse.redirect(new URL("/daftar?error=registration", env.APP_URL), 303);
    }

    return createAuthenticatedRedirect(
      env.APP_URL,
      getSafeRedirectPath(formData.get("next")),
      result.session,
    );
  } catch (error: unknown) {
    return createSafeErrorResponse(error, 503);
  }
}
