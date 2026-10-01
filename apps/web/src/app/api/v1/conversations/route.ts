import { handleConversationList } from "../../../../lib/inbox/route-handlers";
import { getInboxRouteDependencies } from "../../../../lib/inbox/route-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleConversationList(request, getInboxRouteDependencies());
}
