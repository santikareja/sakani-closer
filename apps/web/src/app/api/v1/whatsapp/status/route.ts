import { handleWhatsAppStatus } from "../../../../../lib/whatsapp/route-handlers";
import { getWhatsAppRouteDependencies } from "../../../../../lib/whatsapp/route-runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleWhatsAppStatus(request, getWhatsAppRouteDependencies());
}
