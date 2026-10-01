import { getGatewayEnv, parseGatewayEnv } from "@sakani/config";

export interface GatewayConfig {
  port: number;
  authDataDirectory: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  sessionEncryptionKey: string;
  internalServiceToken: string;
}

export function loadGatewayConfig(
  input?: NodeJS.ProcessEnv | Record<string, unknown>,
): GatewayConfig {
  const env = input ? parseGatewayEnv(input) : getGatewayEnv();
  return {
    port: env.WA_GATEWAY_PORT,
    authDataDirectory: env.WA_AUTH_DATA_DIR,
    logLevel: env.WA_LOG_LEVEL,
    sessionEncryptionKey: env.SESSION_ENCRYPTION_KEY,
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  };
}
