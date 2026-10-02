import { describe, expect, it } from "vitest";

import { createDashboardViewModel } from "./adapter";

describe("dashboard presentation adapter", () => {
  it("marks only supported metrics as live", () => {
    const view = createDashboardViewModel({
      diagnostics: {
        totalConversations: 7,
        lastReceivedAt: "2026-10-02T03:00:00.000Z",
        lastIngestStatus: "accepted",
      },
      conversations: { conversations: [] },
      whatsapp: null,
      role: "owner",
      now: new Date("2026-10-02T04:00:00.000Z"),
    });
    expect(view.metrics.find((metric) => metric.id === "conversations")).toMatchObject({
      value: "7",
      capability: "live",
    });
    expect(
      view.metrics
        .filter((metric) => metric.id !== "conversations")
        .every((metric) => metric.value === null && metric.capability === "unavailable"),
    ).toBe(true);
    expect(view.ai.isAvailable).toBe(false);
  });
});
