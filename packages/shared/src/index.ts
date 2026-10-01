export const APP_NAME = "Sakani Closer";
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface ServiceStatus {
  status: "ok" | "error";
  latencyMs: number;
}

export interface RequestContext {
  correlationId: string;
  workspaceId?: string;
}
