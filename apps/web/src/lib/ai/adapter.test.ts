import { describe, expect, it } from "vitest";

import { createUnavailableAiWorkspace } from "./adapter";

describe("AI unavailable adapter", () => {
  it("never marks a simulated capability as available", () => {
    const workspace = createUnavailableAiWorkspace();
    expect(workspace.isAvailable).toBe(false);
    expect(workspace.capabilities.every((item) => !item.isAvailable && !item.isDemo)).toBe(true);
    expect(workspace.auditNote).toContain("Tidak ada proses AI");
  });
});
