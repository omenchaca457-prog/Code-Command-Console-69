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
        .select({ xp: agentsTable.xp })
        .from(agentsTable)
        .where(eq(agentsTable.id, input.agentId))
        .limit(1);

      return {
        message: existingMessage,
        inserted: false,
        xp: agent?.xp ?? 0,
      };
    }

    const [agent] = await tx
      .insert(agentsTable)
      .values({
        id: input.agentId,
        name: input.agentName,
        xp: input.analysisStatus === "rewarded" ? 1 : 0,
        failedAnalyses: input.analysisStatus === "failed" ? 1 : 0,
        lastOmega: input.omega,
        lastFailure: input.failureReason,
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
          lastOmega: input.omega,
          lastFailure: input.failureReason,
          updatedAt: new Date(),
        },
      })
      .returning({ xp: agentsTable.xp });

    return { message: insertedMessage, inserted: true, xp: agent?.xp ?? 0 };
  });
}
