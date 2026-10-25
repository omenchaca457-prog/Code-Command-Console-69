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

// LEY 4105: el status es un estado de ciclo de vida, no un resultado de tarea.
// Solo las transiciones terminales (failed/completed) pueden escribirlo; cualquier
// valor intermedio preserva el status real para no sobreescribir un "active" explícito.
function nextAgentStatus(
  current: string | null | undefined,
  analysisStatus: AgentAnalysisStatus,
): string {
  if (analysisStatus === "failed") return "failed";
  // Si el nodo fue activado manualmente, no lo degradamos a "completed".
  if (current === "active") return "active";
  return "completed";
}

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

    // Read the live status BEFORE the upsert so we never clobber an explicit "active".
    const [currentAgent] = await tx
      .select({ status: agentsTable.status })
      .from(agentsTable)
      .where(eq(agentsTable.id, input.agentId))
      .limit(1);

    const resolvedStatus = nextAgentStatus(
      currentAgent?.status ?? null,
      input.analysisStatus,
    );

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
        // Nodo nuevo: nace en su estado terminal resuelto, nunca por default "idle".
        status: resolvedStatus,
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
          // Preserva "active"; solo degrada en fallo terminal o marca "completed" si no estaba activo.
          status: sql`CASE
            WHEN ${input.analysisStatus === "failed" ? sql`TRUE` : sql`FALSE`} THEN 'failed'
            WHEN ${agentsTable.status} = 'active' THEN 'active'
            ELSE 'completed'
          END`,
          updatedAt: new Date(),
        },
      })
      .returning({ xp: agentsTable.xp, omega: agentsTable.lastOmega });

    return { message: insertedMessage, inserted: true, xp: agent?.xp ?? 0, omega: agent?.omega ?? null };
  });
}
