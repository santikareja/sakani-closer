import { describe, expect, it } from "vitest";

import { pipelineStages } from "./schema";
import { requireWorkspaceContext, scopeToWorkspace } from "./workspace";

describe("workspace isolation helper", () => {
  it("requires a UUID and creates a scoped predicate", () => {
    const workspaceId = "00000000-0000-4000-8000-000000000001";
    const context = requireWorkspaceContext(workspaceId);
    const predicate = scopeToWorkspace(pipelineStages.workspaceId, context);

    expect(context.workspaceId).toBe(workspaceId);
    expect(predicate).toBeDefined();
  });

  it("rejects a missing or malformed workspace id", () => {
    expect(() => requireWorkspaceContext(undefined)).toThrow();
    expect(() => requireWorkspaceContext("global")).toThrow();
  });
});
