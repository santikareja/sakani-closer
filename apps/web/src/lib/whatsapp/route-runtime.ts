import "server-only";

import { getWebEnv } from "@sakani/config";

import { getCurrentSession } from "../auth/dal";
import { createWhatsAppGatewayClient } from "./gateway-client";
import type { WhatsAppRouteDependencies } from "./route-handlers";

export function getWhatsAppRouteDependencies(): WhatsAppRouteDependencies {
  const env = getWebEnv();
  return {
    applicationUrl: env.APP_URL,
    getSession: getCurrentSession,
    gateway: createWhatsAppGatewayClient(env.WA_GATEWAY_URL, env.INTERNAL_SERVICE_TOKEN),
  };
}
