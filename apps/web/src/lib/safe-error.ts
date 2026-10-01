import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export interface SafeErrorBody {
  status: "error";
  code: string;
  message: string;
  correlationId: string;
}

export function createSafeErrorResponse(
  _error: unknown,
  status = 500,
  correlationId: string = randomUUID(),
): NextResponse<SafeErrorBody> {
  return NextResponse.json(
    {
      status: "error",
      code: "INTERNAL_ERROR",
      message: "Terjadi kendala internal. Silakan coba lagi.",
      correlationId,
    },
    { status },
  );
}
