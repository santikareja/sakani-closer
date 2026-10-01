import { getDatabase, closeDatabase } from "./client";
import { DEFAULT_PIPELINE_STAGES, SAKANI_WORKSPACE } from "./seed-data";
import { pipelineStages, workspaces } from "./schema";

export async function seedDatabase(): Promise<void> {
  const db = getDatabase();

  await db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .insert(workspaces)
      .values(SAKANI_WORKSPACE)
      .onConflictDoUpdate({
        target: workspaces.slug,
        set: { name: SAKANI_WORKSPACE.name, updatedAt: new Date() },
      })
      .returning({ id: workspaces.id });

    if (!workspace) {
      throw new Error("Workspace seed did not return an id");
    }

    for (const stage of DEFAULT_PIPELINE_STAGES) {
      await transaction
        .insert(pipelineStages)
        .values({ workspaceId: workspace.id, ...stage })
        .onConflictDoUpdate({
          target: [pipelineStages.workspaceId, pipelineStages.name],
          set: {
            position: stage.position,
            isTerminal: stage.isTerminal,
            updatedAt: new Date(),
          },
        });
    }
  });
}

const isDirectRun = process.argv[1]?.replaceAll("\\", "/").endsWith("/src/seed.ts") ?? false;

if (isDirectRun) {
  seedDatabase()
    .then(() => {
      console.info("Database seed completed.");
    })
    .catch((error: unknown) => {
      console.error(
        "Database seed failed.",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
