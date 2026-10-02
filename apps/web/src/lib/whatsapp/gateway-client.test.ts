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
          binding: { state: "unbound" },
          lifecyclePersistence: { state: "unknown" },
          history: { capability: "limited" },
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

  it("passes only the server-derived workspace/account binding on connect", async () => {
    const fetchImplementation = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({
        connection: {
          state: "connecting",
          reason: "connect_requested",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        binding: {
          state: "bound",
          workspaceId: "00000000-0000-4000-8000-000000000001",
          accountId: "00000000-0000-4000-8000-000000000002",
        },
        lifecyclePersistence: { state: "unknown" },
        history: { capability: "limited" },
      }),
    );
    const client = createWhatsAppGatewayClient(
      "http://wa-gateway:3001",
      "private-internal-token-at-least-32-characters",
      fetchImplementation as typeof fetch,
    );
    const binding = {
      workspaceId: "00000000-0000-4000-8000-000000000001",
      accountId: "00000000-0000-4000-8000-000000000002",
    };

    await client.connect(binding);
    const [url, init] = fetchImplementation.mock.calls[0]!;
    expect(String(url)).toBe("http://wa-gateway:3001/internal/connect");
    expect(init?.body).toBe(JSON.stringify(binding));
  });
});
