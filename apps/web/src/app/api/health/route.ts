import { createSafeErrorResponse } from "../../../lib/safe-error";
import { getLiveHealthReport, healthReportResponse } from "../../../lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return healthReportResponse(await getLiveHealthReport());
  } catch (error: unknown) {
    return createSafeErrorResponse(error, 503);
  }
}
