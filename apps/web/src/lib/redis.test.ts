import { describe, expect, it, vi } from "vitest";

import { checkRedisConnection } from "./redis";

describe("Redis connection check", () => {
  it("connects when needed and requires PONG", async () => {
    const client = {
      isOpen: false,
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
    };

    await expect(checkRedisConnection(client)).resolves.toBeUndefined();
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledOnce();
  });

  it("fails on an unexpected response", async () => {
    const client = {
      isOpen: true,
      connect: vi.fn(),
      ping: vi.fn().mockResolvedValue("NOPE"),
    };

    await expect(checkRedisConnection(client)).rejects.toThrow("unexpected");
  });
});
