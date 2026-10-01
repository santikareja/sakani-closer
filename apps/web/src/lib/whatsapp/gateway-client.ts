import "server-only";

import type { z } from "zod";

import {
  GatewayRequestError,
  gatewayErrorResponseSchema,
  gatewayQrResponseSchema,
  gatewayStatusResponseSchema,
  type GatewayQrResponse,
  type GatewayStatusResponse,
} from "./contracts";

export interface WhatsAppGatewayClient {
  getStatus(): Promise<GatewayStatusResponse>;
  connect(): Promise<GatewayStatusResponse>;
  disconnect(): Promise<GatewayStatusResponse>;
  getQr(): Promise<GatewayQrResponse>;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GatewayRequestError(502, "INVALID_GATEWAY_RESPONSE");
  }
}

export function createWhatsAppGatewayClient(
  baseUrl: string,
  internalServiceToken: string,
  fetchImplementation: typeof fetch = fetch,
): WhatsAppGatewayClient {
  const request = async <T>(
    path: string,
    schema: z.ZodType<T>,
    method: "GET" | "POST" = "GET",
  ): Promise<T> => {
    let response: Response;
    try {
      response = await fetchImplementation(new URL(path, baseUrl), {
        method,
        headers: {
          authorization: `Bearer ${internalServiceToken}`,
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: "{}" } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new GatewayRequestError(503, "GATEWAY_UNAVAILABLE");
    }

    const payload = await readJson(response);
    if (!response.ok) {
      const parsed = gatewayErrorResponseSchema.safeParse(payload);
      throw new GatewayRequestError(
        response.status,
        parsed.success ? parsed.data.error.code : "GATEWAY_REQUEST_FAILED",
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new GatewayRequestError(502, "INVALID_GATEWAY_RESPONSE");
    return parsed.data;
  };

  return {
    getStatus: () => request("/internal/status", gatewayStatusResponseSchema),
    connect: () => request("/internal/connect", gatewayStatusResponseSchema, "POST"),
    disconnect: () => request("/internal/disconnect", gatewayStatusResponseSchema, "POST"),
    getQr: () => request("/internal/qr", gatewayQrResponseSchema),
  };
}
