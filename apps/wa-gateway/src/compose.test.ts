import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("WhatsApp gateway Compose boundary", () => {
  it("has no host port and no database or Redis dependency", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const gatewayBlock = compose.slice(
      compose.indexOf("  wa-gateway:"),
      compose.indexOf("  migrate:"),
    );

    expect(gatewayBlock).toContain('expose:\n      - "3001"');
    expect(gatewayBlock).toContain("gateway_private");
    expect(gatewayBlock).not.toMatch(/\n\s+ports:/);
    expect(gatewayBlock).not.toMatch(/depends_on:/);
    expect(gatewayBlock).not.toContain("DATABASE_URL");
    expect(gatewayBlock).not.toContain("REDIS_URL");
  });
});
