import { sql } from "drizzle-orm";

export function taskSuccessOmega(successes: number, failures: number): number | null {
  if (!Number.isSafeInteger(successes) || successes < 0 ||
      !Number.isSafeInteger(failures) || failures < 0 ||
      !Number.isSafeInteger(successes + failures)) {
    throw new RangeError("Ω requiere contadores de tareas enteros, seguros y no negativos.");
  }
  const total = successes + failures;
  return total === 0 ? null : successes / total;
}

export type AgentTaskStore = Pick<typeof import("@workspace/db"), "db" | "agentsTable">;

/** Atomic per-row arithmetic; the motor's coherence is never an input. */
export async function recordAgentTaskFailure(agentId: string, reason: string, open: boolean, store?: AgentTaskStore) {
  const { db, agentsTable } = store ?? await import("@workspace/db");
  await db.insert(agentsTable).values({
    id: agentId,
    name: agentId,
    failedAnalyses: 1,
    failedTasks: 1,
    lastOmega: 0,
    lastFailure: reason,
    status: open ? "standby" : "failed",
  }).onConflictDoUpdate({
    target: agentsTable.id,
    set: {
      failedAnalyses: sql`${agentsTable.failedAnalyses} + 1`,
      failedTasks: sql`${agentsTable.failedTasks} + 1`,
      lastOmega: sql`${agentsTable.successfulTasks}::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`,
      lastFailure: reason,
      status: open ? "standby" : "failed",
      updatedAt: new Date(),
    },
  });
}
