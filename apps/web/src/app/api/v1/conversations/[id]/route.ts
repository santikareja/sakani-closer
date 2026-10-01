import { handleConversationDetail } from "../../../../../lib/inbox/route-handlers";
import { getInboxRouteDependencies } from "../../../../../lib/inbox/route-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handleConversationDetail(request, id, getInboxRouteDependencies());
}
