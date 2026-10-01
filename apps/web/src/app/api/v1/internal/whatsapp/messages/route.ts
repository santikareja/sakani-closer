import { getWebEnv } from "@sakani/config";
import { createLogger } from "@sakani/logger";

import { handleWhatsAppInboundEvent } from "../../../../../../lib/whatsapp/inbound-handler";
import { DrizzleInboundRepository } from "../../../../../../lib/whatsapp/inbound-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const env = getWebEnv();
  return handleWhatsAppInboundEvent(request, {
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
    repository: new DrizzleInboundRepository(),
    logger: createLogger({ level: env.LOG_LEVEL, base: { service: "web" } }),
  });
}
