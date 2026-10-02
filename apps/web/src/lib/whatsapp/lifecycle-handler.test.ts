import type { WorkspaceContext } from "@sakani/database";
import { describe, expect, it, vi } from "vitest";

import { InboundAccountNotFoundError } from "./inbound-types";
import { handleWhatsAppLifecycleEvent, type LifecycleRepository } from "./lifecycle-handler";

const token = "internal-service-token-with-at-least-32-characters";
const workspaceId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";

function request(overrides: Record<string, unknown> = {}, authorization = `Bearer ${token}`) {
  return new Request("http://web:3000/api/v1/internal/whatsapp/lifecycle", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      binding: { workspaceId, accountId },
      correlationId: "00000000-0000-4000-8000-000000000003",
      state: "connected",
      occurredAt: "2026-10-02T00:00:00.000Z",
      phoneNumberMasked: "62812****789",
      ...overrides,
    }),
  });
}

function setup(repository?: LifecycleRepository) {
  const persistLifecycle = vi.fn(
    async (
      _context: WorkspaceContext,
      _accountId: string,
      _event: {
        state: "connected" | "disconnected";
        phoneNumberMasked?: string | undefined;
      },
    ) => undefined,
  );
  return {
    persistLifecycle,
    dependencies: {
      internalServiceToken: token,
      repository: repository ?? { persistLifecycle },
      logger: { info: vi.fn(), error: vi.fn() },
    },
  };
}

describe("WhatsApp lifecycle internal boundary", () => {
  it("persists a validated workspace-scoped connected event", async () => {
    const { dependencies, persistLifecycle } = setup();
    const response = await handleWhatsAppLifecycleEvent(request(), dependencies);

    expect(response.status).toBe(202);
    const [context, persistedAccountId, event] = persistLifecycle.mock.calls[0]!;
    expect((context as WorkspaceContext).workspaceId).toBe(workspaceId);
    expect(persistedAccountId).toBe(accountId);
    expect(event).toEqual({ state: "connected", phoneNumberMasked: "62812****789" });
  });

  it("rejects missing authorization and malformed identity without persistence", async () => {
    const { dependencies, persistLifecycle } = setup();
    const unauthorized = await handleWhatsAppLifecycleEvent(
      request({}, "Bearer wrong"),
      dependencies,
    );
    const malformed = await handleWhatsAppLifecycleEvent(
      request({ binding: { workspaceId, accountId: "not-a-uuid" } }),
      dependencies,
    );

    expect(unauthorized.status).toBe(401);
    expect(malformed.status).toBe(400);
    expect(persistLifecycle).not.toHaveBeenCalled();
  });

  it("rejects a binding that does not resolve to the default workspace account", async () => {
    const repository: LifecycleRepository = {
      persistLifecycle: vi.fn(async () => {
        throw new InboundAccountNotFoundError();
      }),
    };
    const { dependencies } = setup(repository);
    const response = await handleWhatsAppLifecycleEvent(request(), dependencies);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "ACCOUNT_BINDING_NOT_FOUND" },
    });
  });
});
