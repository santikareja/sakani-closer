import { createHash } from "node:crypto";

export interface RateLimitRedisClient {
  isOpen: boolean;
  connect(): Promise<unknown>;
  sendCommand(command: string[]): Promise<unknown>;
}

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export function createLoginRateLimitKey(ipAddress: string, email: string): string {
  const identifier = createHash("sha256")
    .update(`${ipAddress.slice(0, 128)}|${email.trim().toLowerCase().slice(0, 320)}`)
    .digest("hex");
  return `auth:login:${identifier}`;
}

export async function consumeLoginAttempt(
  client: RateLimitRedisClient,
  key: string,
  maximumAttempts = 5,
  windowSeconds = 15 * 60,
): Promise<boolean> {
  if (!client.isOpen) {
    await client.connect();
  }

  const result = await client.sendCommand([
    "EVAL",
    RATE_LIMIT_SCRIPT,
    "1",
    key,
    String(windowSeconds),
  ]);
  return typeof result === "number" && result <= maximumAttempts;
}

export function getRequestIpAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
