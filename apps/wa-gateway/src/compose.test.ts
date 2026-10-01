import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("WhatsApp gateway Compose boundary", () => {
  it("copies every workspace runtime dependency into the gateway runner image", async () => {
    const [dockerfile, packageJsonText] = await Promise.all([
      readFile("apps/wa-gateway/Dockerfile", "utf8"),
      readFile("apps/wa-gateway/package.json", "utf8"),
    ]);
    const packageJson = JSON.parse(packageJsonText) as {
      dependencies?: Record<string, string>;
    };
    const workspacePackages = Object.entries(packageJson.dependencies ?? {})
      .filter(
        ([packageName, version]) => packageName.startsWith("@sakani/") && version === "workspace:*",
      )
      .map(([packageName]) => packageName.slice("@sakani/".length));

    expect(workspacePackages).toEqual(["config", "logger", "shared"]);
    for (const packageDirectory of workspacePackages) {
      expect(dockerfile).toContain(
        `COPY --from=builder /app/packages/${packageDirectory} /app/packages/${packageDirectory}`,
      );
    }
  });

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
    expect(gatewayBlock).not.toContain("APP_URL");
    expect(gatewayBlock).not.toContain("AUTH_SECRET");
    expect(gatewayBlock).toContain(
      "WA_INGEST_URL: http://web:3000/api/v1/internal/whatsapp/messages",
    );
  });

  it("allows only the web backend to reach the gateway through the private network", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const webBlock = compose.slice(compose.indexOf("  web:"), compose.indexOf("  wa-gateway:"));

    expect(webBlock).toContain("WA_GATEWAY_URL: http://wa-gateway:3001");
    expect(webBlock).toContain("INTERNAL_SERVICE_TOKEN:");
    expect(webBlock).toContain("gateway_private");
    expect(webBlock).not.toContain('"3001:3001"');
  });
});
