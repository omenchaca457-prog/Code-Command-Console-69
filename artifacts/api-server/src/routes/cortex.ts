import { Router } from "express";
import { pool } from "@workspace/db";
import { executeDeepseekTool } from "./deepseek-tools";
import { MAX_EDITOR_CODE, validateCortexInput } from "./cortex-context";
import { publishNeuralEvent } from "./neural-event-bus";

export function createCortexRouter() {
  const router = Router();

  router.post("/cortex/context", async (req, res) => {
    let clientContext: ReturnType<typeof validateCortexInput>;
    try {
      clientContext = validateCortexInput(req.body);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Contexto inválido." });
      return;
    }

    try {
      const [workspace, diagnostics, library, integrations, neural, terminalHistory, learning, learningTotal] = await Promise.all([
        executeDeepseekTool("get_workspace_snapshot", "{}"),
        executeDeepseekTool("get_runtime_diagnostics", "{}"),
        executeDeepseekTool("get_library_snapshot", "{}"),
        executeDeepseekTool("get_integrations_status", "{}"),
        executeDeepseekTool("get_neural_activity", "{}"),
        pool.query(
          `SELECT role, content, created_at FROM messages
           WHERE conversation_id = (
             SELECT id FROM conversations
             WHERE title = 'terminal_main_session'
             ORDER BY id ASC LIMIT 1
           )
           ORDER BY id DESC LIMIT 10`,
        ),
        pool.query(
          `SELECT content, created_at FROM neural_events
           WHERE origin = 'terminal' AND event_type = 'cortex_learning'
           ORDER BY created_at DESC LIMIT 6`,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total FROM neural_events
           WHERE origin = 'terminal' AND event_type = 'cortex_learning'`,
        ),
      ]);
      const context = {
        capturedAt: new Date().toISOString(),
        editor: {
          language: clientContext.editor.language,
          code: clientContext.editor.code,
          truncated: typeof req.body?.editor?.code === "string" &&
            req.body.editor.code.length > MAX_EDITOR_CODE,
        },
        runnerAndAgentActivity: clientContext.activity,
        databaseAndAgents: JSON.parse(workspace),
        serverAndWebviewLogs: JSON.parse(diagnostics),
        library: JSON.parse(library),
        integrations: JSON.parse(integrations),
        neuralActivity: JSON.parse(neural),
        recentTerminalConversation: terminalHistory.rows.reverse(),
        priorCortexLearning: learning.rows.map((row) => ({
          content: row.content,
          createdAt: row.created_at,
        })),
        note: "Los datos de Integrations son un snapshot manual y no estado en tiempo real.",
      };
      res.json({
        context,
        sources: ["Terminal", "Editor", "Runner", "Library", "AI", "Tools (solo lectura)", "Red Neuronal", "Agentes", "PostgreSQL", "Integrations (snapshot)", "Server Logs", "Webview Logs"],
        learningCount: learningTotal.rows[0]?.total ?? 0,
      });
    } catch (error) {
      req.log.error({ err: error }, "No se pudo reunir el contexto de Cortex");
      res.status(503).json({ error: "No se pudo reunir el contexto completo de la terminal." });
    }
  });

  router.post("/cortex/learning", async (req, res) => {
    const { question, deepseek, gemini, openai } = req.body ?? {};
    if (typeof question !== "string" || !question.trim() ||
        (typeof deepseek !== "string" && typeof gemini !== "string")) {
      res.status(400).json({ error: "Se requiere la pregunta y al menos una respuesta." });
      return;
    }
    const record = JSON.stringify({
      question: question.trim().slice(0, 1000),
      deepseek: typeof deepseek === "string" ? deepseek.slice(0, 1500) : "",
      gemini: typeof gemini === "string" ? gemini.slice(0, 1500) : "",
      openai: typeof openai === "string" ? openai.slice(0, 1500) : "",
    });
    try {
      const { rows } = await pool.query<{
        id: number;
        origin: "terminal";
        event_type: string;
        content: string;
        created_at: Date;
      }>(
        `INSERT INTO neural_events (origin, event_type, content)
         VALUES ('terminal', 'cortex_learning', $1)
         RETURNING id, origin, event_type, content, created_at`,
        [record],
      );
      const savedEvent = rows[0];
      if (savedEvent) {
        await publishNeuralEvent({
          id: savedEvent.id,
          origin: savedEvent.origin,
          eventType: savedEvent.event_type,
          content: savedEvent.content,
          createdAt: savedEvent.created_at.toISOString(),
        });
      }
      res.status(201).json({ saved: true });
    } catch (error) {
      req.log.error({ err: error }, "No se pudo guardar la memoria de Cortex");
      res.status(503).json({ error: "No se pudo guardar esta sesión en la memoria de Cortex." });
    }
  });

  return router;
}

export default createCortexRouter();
