import { agentsTable, db, messages } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type AgentAnalysisStatus = "rewarded" | "review" | "failed";

type PersistAgentResponseInput = {
  conversationId: number;
  idempotencyKey: string;
  agentId: string;
  agentName: string;
  content: string;
  omega: number | null;
  analysisStatus: AgentAnalysisStatus;
  failureReason: string | null;
};

export async function persistAgentResponse(
  input: PersistAgentResponseInput,
) {
  return db.transaction(async (tx) => {
    const [insertedMessage] = await tx
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: "assistant",
        content: input.content,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: messages.idempotencyKey })
      .returning();

    if (!insertedMessage) {
      const [existingMessage] = await tx
        .select()
        .from(messages)
        .where(eq(messages.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (!existingMessage) {
        throw new Error("No se encontró el mensaje que causó el conflicto.");
      }

      const [agent] = await tx
        .select({ xp: agentsTable.xp, omega: agentsTable.lastOmega })
        .from(agentsTable)
        .where(eq(agentsTable.id, input.agentId))
        .limit(1);

      return {
        message: existingMessage,
        inserted: false,
        xp: agent?.xp ?? 0,
        omega: agent?.omega ?? null,
      };
    }

    const [agent] = await tx
      .insert(agentsTable)
      .values({
        id: input.agentId,
        name: input.agentName,
        xp: input.analysisStatus === "rewarded" ? 1 : 0,
        failedAnalyses: input.analysisStatus === "failed" ? 1 : 0,
        successfulTasks: input.omega !== null && input.analysisStatus !== "failed" ? 1 : 0,
        failedTasks: input.analysisStatus === "failed" ? 1 : 0,
        lastOmega: input.omega === null ? null : input.analysisStatus === "failed" ? 0 : 1,
        lastFailure: input.failureReason,
        status: input.analysisStatus === "failed" ? "failed" : "completed",
      })
      .onConflictDoUpdate({
        target: agentsTable.id,
        set: {
          name: input.agentName,
          xp:
            input.analysisStatus === "rewarded"
              ? sql`${agentsTable.xp} + 1`
              : sql`${agentsTable.xp}`,
          failedAnalyses:
            input.analysisStatus === "failed"
              ? sql`${agentsTable.failedAnalyses} + 1`
              : sql`${agentsTable.failedAnalyses}`,
          successfulTasks: input.omega !== null && input.analysisStatus !== "failed"
            ? sql`${agentsTable.successfulTasks} + 1` : sql`${agentsTable.successfulTasks}`,
          failedTasks: input.analysisStatus === "failed"
            ? sql`${agentsTable.failedTasks} + 1` : sql`${agentsTable.failedTasks}`,
          lastOmega: input.omega === null
            ? sql`CASE WHEN ${agentsTable.successfulTasks} + ${agentsTable.failedTasks} > 0
              THEN ${agentsTable.successfulTasks}::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks})
              ELSE NULL END`
            : input.analysisStatus === "failed"
            ? sql`${agentsTable.successfulTasks}::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`
            : sql`(${agentsTable.successfulTasks} + 1)::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`,
          lastFailure: input.failureReason,
          status: input.analysisStatus === "failed" ? "failed" : "completed",
          updatedAt: new Date(),
        },
      })
      .returning({ xp: agentsTable.xp, omega: agentsTable.lastOmega });

    return { message: insertedMessage, inserted: true, xp: agent?.xp ?? 0, omega: agent?.omega ?? null };
  });
}
