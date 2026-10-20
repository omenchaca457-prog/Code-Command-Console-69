import { inArray, sql } from "drizzle-orm";
import type { AgentTaskStore } from "./agent-task-outcomes.ts";

/** Reconcile legacy motor-derived scores without inventing historic outcomes. */
export async function initializeAgentTelemetry(store?: AgentTaskStore) {
  const { db, agentsTable } = store ?? await import("@workspace/db");
  await db.transaction(async tx => {
    await tx.update(agentsTable).set({
      lastOmega: sql`CASE WHEN ${agentsTable.successfulTasks} + ${agentsTable.failedTasks} > 0
        THEN ${agentsTable.successfulTasks}::double precision /
          (${agentsTable.successfulTasks} + ${agentsTable.failedTasks})
        ELSE NULL END`,
    }).where(inArray(agentsTable.id, ["optimizer", "security", "coherence"]));
    await tx.insert(agentsTable).values({
      id: "orquestador-openai",
      name: "ORQUESTADOR-OPENAI",
      status: "idle",
    }).onConflictDoUpdate({
      target: agentsTable.id,
      set: { status: "idle", updatedAt: new Date() },
    });
  });
}
