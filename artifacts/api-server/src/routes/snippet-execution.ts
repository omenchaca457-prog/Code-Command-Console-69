import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { ExecuteSnippetParams, ExecuteSnippetResponse } from "@workspace/api-zod";

const SIMULATED_OUTPUT = "Hello, DevTerminal!" as const;

/** The timestamp records a simulation, not proof that the stored code ran. */
export async function recordSimulatedSnippetExecution(id: number) {
  const { db, snippetsTable, neuralEventsTable } = await import("@workspace/db");
  return db.transaction(async tx => {
    const [snippet] = await tx.update(snippetsTable)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(snippetsTable.id, id))
      .returning({ id: snippetsTable.id, lastRunAt: snippetsTable.lastRunAt });
    if (!snippet) return null;
    if (!snippet.lastRunAt) throw new Error("No se confirmó last_run_at.");
    const result = {
      id: snippet.id, success: true as const, simulated: true as const,
      output: SIMULATED_OUTPUT, lastRunAt: snippet.lastRunAt,
    };
    // Persist provenance in the same transaction. Do not present a simulated
    // output as a real Runner execution to auditors or reliability metrics.
    await tx.insert(neuralEventsTable).values({
      origin: "runner",
      eventType: "snippet_execution_simulated",
      content: JSON.stringify(result),
    });
    return result;
  });
}

export function createSnippetExecutionRouter(
  executeSnippet = recordSimulatedSnippetExecution,
) {
  const router = Router();
  router.post("/snippets/:id/execute", async (req, res): Promise<void> => {
    const parsed = ExecuteSnippetParams.safeParse(req.params);
    if (!parsed.success || !Number.isSafeInteger(parsed.data.id)) {
      res.status(400).json({ error: "Invalid snippet id" });
      return;
    }
    try {
      const result = await executeSnippet(parsed.data.id);
      if (!result) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }
      const response = ExecuteSnippetResponse.parse(result);
      req.log?.info({
        event: "snippet_execution_simulated", snippetId: result.id,
        simulated: true, lastRunAt: result.lastRunAt,
      }, "Se registró una ejecución simulada; no se ejecutó el código del Runner");
      res.json(response);
    } catch (error) {
      req.log?.error({ err: error, snippetId: parsed.data.id }, "No se pudo registrar la ejecución simulada");
      res.status(500).json({ error: "Could not record simulated execution" });
    }
  });
  return router;
}
