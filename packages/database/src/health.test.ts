import { describe, expect, it, vi } from "vitest";

import { checkDatabaseConnection } from "./health";

describe("database connection check", () => {
  it("runs a minimal query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ healthy: 1 }] });

    await expect(checkDatabaseConnection({ query })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith("select 1 as healthy");
  });

  it("propagates connection failures for the health boundary", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused: secret-url"));

    await expect(checkDatabaseConnection({ query })).rejects.toThrow("connection refused");
  });
});
