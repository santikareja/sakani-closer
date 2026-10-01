import { describe, expect, it } from "vitest";

import { createSafeErrorResponse } from "./safe-error";

describe("safe error response", () => {
  it("does not expose secrets, stack traces, or connection strings", async () => {
    const secret = "postgresql://admin:super-secret@database.internal:5432/app";
    const response = createSafeErrorResponse(new Error(`failed at ${secret}`), 503, "request-123");
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("super-secret");
    expect(body).not.toContain("database.internal");
    expect(body).not.toContain("stack");
    expect(body).toContain("request-123");
  });
});
