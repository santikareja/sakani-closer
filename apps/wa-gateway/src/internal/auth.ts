import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function hasValidInternalToken(request: IncomingMessage, expectedToken: string): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return false;
  const suppliedToken = authorization.slice("Bearer ".length);
  if (suppliedToken.length === 0) return false;
  return timingSafeEqual(digest(suppliedToken), digest(expectedToken));
}
