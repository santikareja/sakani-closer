import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWhatsAppGatewayClient } from "./gateway-client";

describe("WhatsApp gateway server client", () => {
  it("sends the internal token only in the private authorization header", async () => {
    const token = "private-internal-token-at-least-32-characters";
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        return Response.json({
          connection: {
            state: "disconnected",
            reason: "service_started",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        });
      },
    );
    const client = createWhatsAppGatewayClient(
      "http://wa-gateway:3001",
      token,
      fetchImplementation as typeof fetch,
    );

    const result = await client.getStatus();
    const [url, init] = fetchImplementation.mock.calls[0]!;

    expect(String(url)).toBe("http://wa-gateway:3001/internal/status");
    expect(init?.headers).toMatchObject({ authorization: `Bearer ${token}` });
    expect(JSON.stringify(result)).not.toContain(token);
  });
});
