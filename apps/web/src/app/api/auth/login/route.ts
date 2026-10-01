import { getWebEnv } from "@sakani/config";
import { NextResponse, type NextRequest } from "next/server";

import { createSafeErrorResponse } from "../../../../lib/safe-error";
import { getSafeRedirectPath, isSameOriginMutation } from "../../../../lib/auth/http";
import {
  consumeLoginAttempt,
  createLoginRateLimitKey,
  getRequestIpAddress,
} from "../../../../lib/auth/rate-limit";
import { createAuthenticatedRedirect } from "../../../../lib/auth/route-helpers";
import { getAuthService } from "../../../../lib/auth/runtime";
import { getRedisClient } from "../../../../lib/redis";

export async function POST(request: NextRequest): Promise<Response> {
  const env = getWebEnv();
  if (!isSameOriginMutation(request, env.APP_URL)) {
    return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "");
    const redirectPath = getSafeRedirectPath(formData.get("next"));
    const rateLimitKey = createLoginRateLimitKey(getRequestIpAddress(request.headers), email);
    const allowed = await consumeLoginAttempt(getRedisClient(env.REDIS_URL), rateLimitKey);

    if (!allowed) {
      const url = new URL("/login", env.APP_URL);
      url.searchParams.set("error", "rate-limited");
      return NextResponse.redirect(url, 303);
    }

    const result = await getAuthService().login({
      email,
      password: String(formData.get("password") ?? ""),
    });
    if (!result.ok) {
      const url = new URL("/login", env.APP_URL);
      url.searchParams.set("error", "credentials");
      if (redirectPath !== "/dashboard") {
        url.searchParams.set("next", redirectPath);
      }
      return NextResponse.redirect(url, 303);
    }

    return createAuthenticatedRedirect(env.APP_URL, redirectPath, result.session);
  } catch (error: unknown) {
    return createSafeErrorResponse(error, 503);
  }
}
