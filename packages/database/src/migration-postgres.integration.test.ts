import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as schema from "./schema";
import { messageMedia, messages, workspaces } from "./schema";
import { verifyRequiredSchema } from "./verify-schema";

const integrationUrl = process.env.DATABASE_INTEGRATION_URL;
const describeWithPostgres = integrationUrl ? describe : describe.skip;

describeWithPostgres("committed migrations on a real PostgreSQL test database", () => {
  it("creates the complete inbox schema", async () => {
    if (!integrationUrl) throw new Error("DATABASE_INTEGRATION_URL is required");
    if (integrationUrl === process.env.DATABASE_URL) {
      throw new Error("Integration database must not be the runtime database");
    }
    const databaseName = new URL(integrationUrl).pathname.slice(1).toLowerCase();
    if (!databaseName.includes("test")) {
      throw new Error("Integration database name must contain 'test'");
    }

    const pool = new Pool({ connectionString: integrationUrl, max: 1 });
    try {
      const [{ DrizzleInboxRepository }, { DrizzleInboundRepository }] = await Promise.all([
        import("../../../apps/web/src/lib/inbox/repository"),
        import("../../../apps/web/src/lib/whatsapp/inbound-repository"),
      ]);
      const database = drizzle(pool, { schema });
      await migrate(database, {
        migrationsFolder: resolve("packages/database/drizzle"),
      });
      const result = await verifyRequiredSchema(pool);
      expect(result.missingTables).toEqual([]);
      expect(result.migrationCount).toBeGreaterThanOrEqual(3);

      const workspaceId = randomUUID();
      const otherWorkspaceId = randomUUID();
      await database.insert(workspaces).values([
        { id: workspaceId, name: "Migration Test", slug: `migration-test-${workspaceId}` },
        { id: otherWorkspaceId, name: "Other Test", slug: `other-test-${otherWorkspaceId}` },
      ]);
      const inbound = new DrizzleInboundRepository(database);
      const account = await inbound.ensureAccount({ workspaceId });
      const rollbackProviderId = `rollback-${randomUUID()}`;
      await expect(
        inbound.ingestAccepted({ workspaceId }, account.id, {
          outcome: "accepted",
          providerMessageId: rollbackProviderId,
          providerMessageIdHash: "c".repeat(64),
          chatIdentifierHash: "d".repeat(64),
          direction: "inbound",
          messageType: "document",
          media: { mimeType: "x".repeat(256) },
          providerTimestamp: new Date().toISOString(),
          fromMe: false,
        }),
      ).rejects.toThrow();
      const rolledBackMessages = await database
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.providerMessageId, rollbackProviderId));
      expect(rolledBackMessages).toEqual([]);

      const inboundMessage = {
        outcome: "accepted" as const,
        providerMessageId: `provider-${randomUUID()}`,
        providerMessageIdHash: "a".repeat(64),
        chatIdentifierHash: "b".repeat(64),
        displayName: "PostgreSQL Test",
        phoneMasked: "62812****789",
        direction: "inbound" as const,
        messageType: "text" as const,
        text: "Pesan integration test",
        media: { mimeType: "image/jpeg", fileName: "test.jpg", fileSize: 1_024 },
        providerTimestamp: new Date().toISOString(),
        fromMe: false as const,
      };

      await expect(
        inbound.ingestAccepted({ workspaceId }, account.id, inboundMessage),
      ).resolves.toBe("created");
      await expect(
        inbound.ingestAccepted({ workspaceId }, account.id, inboundMessage),
      ).resolves.toBe("duplicate");
      const storedMedia = await database
        .select({ storageKey: messageMedia.storageKey, status: messageMedia.processingStatus })
        .from(messageMedia);
      expect(storedMedia).toContainEqual({ storageKey: null, status: "metadata_only" });

      const inbox = new DrizzleInboxRepository(database);
      const currentWorkspace = await inbox.listConversations({ workspaceId });
      const otherWorkspace = await inbox.listConversations({ workspaceId: otherWorkspaceId });
      expect(currentWorkspace.conversations).toHaveLength(1);
      expect(currentWorkspace.conversations[0]?.lastMessagePreview).toBe("Pesan integration test");
      expect(otherWorkspace.conversations).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
