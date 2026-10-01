import { handleWhatsAppMutation } from "../../../../../lib/whatsapp/route-handlers";
import { getWhatsAppRouteDependencies } from "../../../../../lib/whatsapp/route-runtime";

export function POST(request: Request): Promise<Response> {
  return handleWhatsAppMutation(request, getWhatsAppRouteDependencies(), "refresh");
}
