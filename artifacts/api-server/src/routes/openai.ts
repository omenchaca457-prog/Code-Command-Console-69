import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { publishNeuralEvent } from "./neural-event-bus.ts";

const AGENT_ID = "orquestador-openai";
const AGENT_NAME = "ORQUESTADOR-OPENAI";
const MAX_PROMPT_LENGTH = 30_000;
const SYSTEM_PROMPT =
  "Eres ORQUESTADOR-OPENAI. Lee el estado real de los agentes proporcionado desde PostgreSQL " +
  "y emite una orden final concreta, breve y accionable para coordinar el enjambre. " +
  "No inventes estados ni resultados.";
const getConfiguredOpenAiKey = () =>
  process.env.chatgpt || process.env.OPENAI_API_KEY || process.env.openIA;

type AgentState = {
  id: string;
  name: string;
  status: string;
  xp: number;
  failedAnalyses: number;
  lastOmega: number | null;
  lastFailure: string | null;
  updatedAt: Date;
};

type ChatChunk = { choices: Array<{ delta: { content?: string | null } }> };
type DecisionEventStatus = "delivered" | "persisted_only" | "persistence_failed";
type AgentResult = {
  agent: string;
  status: "completed" | "failed";
  response: string;
  error?: string;
};

export function getOpenAiFailureMessage(error: unknown): string {
  const details = error && typeof error === "object"
    ? error as { status?: unknown; code?: unknown }
    : {};
  if (details.status === 401 || details.code === "invalid_api_key") {
    return "OpenAI rechazó la credencial. Revoca la llave expuesta y actualiza el Secret chatgpt.";
  }
  if (details.status === 403) {
    return "La cuenta de OpenAI no tiene permiso para usar GPT-4o.";
  }
  if (details.code === "credit_balance_exhausted") {
    return "La cuenta o proyecto de OpenAI agotó sus créditos. Revisa la facturación de OpenAI.";
  }
  if (details.status === 429) {
    return "OpenAI alcanzó su límite de solicitudes. Inténtalo de nuevo más tarde.";
  }
  return "OpenAI no pudo completar la orden. Revisa la conexión del proveedor.";
}

type OpenAiRouteDependencies = {
  getApiKey: () => string | undefined;
  loadAgentStates: () => Promise<AgentState[]>;
  streamCompletion: (input: {
    prompt: string;
    agents: AgentState[];
    agentResults: AgentResult[];
  }) => AsyncIterable<ChatChunk>;
  persistAndPublishDecision: (content: string) => Promise<DecisionEventStatus>;
};

const defaultDependencies: OpenAiRouteDependencies = {
  getApiKey: getConfiguredOpenAiKey,
  loadAgentStates: async () => {
    const { agentsTable, db } = await import("@workspace/db");
    const { asc } = await import("drizzle-orm");
    await db
      .insert(agentsTable)
      .values({ id: AGENT_ID, name: AGENT_NAME, status: "active" })
      .onConflictDoUpdate({
        target: agentsTable.id,
        set: { name: AGENT_NAME, status: "active", updatedAt: new Date() },
      });
    return db
      .select({
        id: agentsTable.id,
        name: agentsTable.name,
        status: agentsTable.status,
        xp: agentsTable.xp,
        failedAnalyses: agentsTable.failedAnalyses,
        lastOmega: agentsTable.lastOmega,
        lastFailure: agentsTable.lastFailure,
        updatedAt: agentsTable.updatedAt,
      })
      .from(agentsTable)
      .orderBy(asc(agentsTable.updatedAt));
  },
  streamCompletion: async function* ({ prompt, agents, agentResults }) {
    const apiKey = getConfiguredOpenAiKey();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Estado actual de agentes (PostgreSQL):\n${JSON.stringify(agents)}\n\n` +
            `Resultados de los agentes paralelos:\n${JSON.stringify(agentResults)}\n\n` +
            `Solicitud de coordinación:\n${prompt}`,
        },
      ],
    });
    for await (const chunk of stream) yield chunk;
  },
  persistAndPublishDecision: async (content) => {
    const { agentsTable, db, neuralEventsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    let created;
    try {
      [created] = await db
        .insert(neuralEventsTable)
        .values({
          origin: "agents",
          eventType: "openai_orchestration",
          content: `OpenAI-Master: ${content.slice(0, 12_000)}`,
        })
        .returning();
    } catch {
      return "persistence_failed";
    }
    if (!created) return "persistence_failed";
    let eventStatus: DecisionEventStatus = "delivered";
    try {
      await publishNeuralEvent({
        id: created.id,
        origin: "agents",
        eventType: created.eventType,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
      });
    } catch {
      eventStatus = "persisted_only";
    }
    await db
      .update(agentsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(agentsTable.id, AGENT_ID));
    return eventStatus;
  },
};

export function createOpenAiRouter(
  overrides: Partial<OpenAiRouteDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const router = Router();

  router.post("/openai/chat", async (req: Request, res: Response) => {
    const prompt = req.body?.prompt;
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Escribe una instrucción para el orquestador." });
      return;
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      res.status(413).json({ error: "La instrucción supera el límite permitido." });
      return;
    }
    const rawAgentResults = req.body?.agentResults;
    if (rawAgentResults !== undefined && (
      !Array.isArray(rawAgentResults) ||
      rawAgentResults.length > 4 ||
      rawAgentResults.some((item) =>
        !item || typeof item !== "object" ||
        typeof item.agent !== "string" ||
        !["completed", "failed"].includes(item.status) ||
        typeof item.response !== "string" ||
        item.response.length > 8_000 ||
        (item.error !== undefined && (typeof item.error !== "string" || item.error.length > 500))
      )
    )) {
      res.status(400).json({ error: "Resultados de agentes inválidos." });
      return;
    }
    const agentResults = (rawAgentResults ?? []) as AgentResult[];
    if (!dependencies.getApiKey()) {
      res.status(503).json({
        error: "OpenAI no está configurado. Añade OPENAI_API_KEY o chatgpt en Secrets.",
      });
      return;
    }

    let generationCompleted = false;
    try {
      const agents = await dependencies.loadAgentStates();
      const stream = dependencies.streamCompletion({
        prompt: prompt.trim(),
        agents,
        agentResults,
      });
      res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      let decision = "";
      for await (const chunk of stream) {
        if (res.destroyed || res.writableEnded) return;
        const delta = chunk.choices[0]?.delta.content ?? "";
        if (!delta) continue;
        decision += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      }
      generationCompleted = true;
      if (!decision.trim()) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "OpenAI devolvió una respuesta vacía." })}\n\n`);
        res.end();
        return;
      }
      const eventStatus = await dependencies.persistAndPublishDecision(decision.trim());
      res.write(`data: ${JSON.stringify({
        type: "done",
        agent: AGENT_NAME,
        node: "OpenAI-Master",
        eventStatus,
      })}\n\n`);
      res.end();
    } catch (error) {
      const details = error && typeof error === "object"
        ? error as { status?: unknown; code?: unknown }
        : {};
      req.log.error(
        { status: details.status, code: details.code },
        "Falló el orquestador OpenAI",
      );
      if (res.headersSent && !res.destroyed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: "error",
          error: generationCompleted
            ? "La orden se generó, pero ocurrió un error al registrar el estado de OpenAI-Master."
            : getOpenAiFailureMessage(error),
        })}\n\n`);
        res.end();
      } else if (!res.headersSent) {
        res.status(502).json({ error: "No se pudo completar la consulta a OpenAI." });
      }
    }
  });

  return router;
}

export default createOpenAiRouter();
