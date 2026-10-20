import { Router } from "express";
import type OpenAI from "openai";
import { db, conversations, messages, agentsTable, neuralEventsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc, sql } from "drizzle-orm";
import { AiChatBody, AiExplainBody, AiImproveBody } from "@workspace/api-zod";
import { persistAgentResponse } from "./agent-message-persistence";
import {
  buildAgentEvidenceMetrics,
  buildAgentSystemPrompt,
  evaluateAgentResponse,
} from "./agent-evaluation";
import { AgentCircuitBreaker } from "./agent-circuit-breaker";
import { publishNeuralEvent } from "./neural-event-bus";
import {
  AI_CODE_TOOLS,
  createAiCodeChatRouter,
  type AiCodeCompletionResult,
} from "./ai-code-chat";

const router = Router();
const agentCircuitBreaker = new AgentCircuitBreaker();
const AGENT_PROVIDER_TIMEOUT_MS = 5_000;

router.use(createAiCodeChatRouter({
  parseBody: (body) => AiChatBody.safeParse(body),
  prepareConversation: async (message, systemPrompt) => {
    const [conv] = await db
      .insert(conversations)
      .values({ title: message.slice(0, 60) })
      .returning();
    await db.insert(messages).values([
      { conversationId: conv.id, role: "system", content: systemPrompt },
      { conversationId: conv.id, role: "user", content: message },
    ]);
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.id));
    return {
      conversationId: conv.id,
      history: history.map((item) => ({
        role: item.role as "system" | "user" | "assistant" | "tool",
        content: item.content,
      })),
    };
  },
  saveAssistantResponse: async (conversationId, content) => {
    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content,
    });
  },
  createCompletion: async (messages, tools) =>
    await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...(tools
        ? {
            tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto" as const,
          }
        : {}),
    }) as unknown as AiCodeCompletionResult,
  executeTool: async (name, argumentsJson) => {
    const { executeDeepseekTool } = await import("./deepseek-tools.ts");
    return executeDeepseekTool(name, argumentsJson);
  },
}));

router.get("/agents", async (_req, res) => {
  const records = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      xp: agentsTable.xp,
      failedAnalyses: agentsTable.failedAnalyses,
      omega: agentsTable.lastOmega,
      status: agentsTable.status,
      lastFailure: agentsTable.lastFailure,
    })
    .from(agentsTable);
  res.json(records);
});

router.post("/ai/chat", async (req, res) => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const {
    message,
    context,
    language,
    agentId,
    agentName,
    agentRolePrompt,
    idempotencyKey,
  } = parsed.data;
  if (agentId && !/^[a-z0-9_-]{1,64}$/.test(agentId)) {
    res.status(400).json({ error: "Identificador de agente inválido." });
    return;
  }
  if (agentId && !idempotencyKey) {
    res.status(400).json({
      error: "Los análisis de agentes requieren una clave de idempotencia.",
    });
    return;
  }
  if (!agentId) {
    res.status(400).json({ error: "El agente solicitado no es válido." });
    return;
  }

  if (agentId && idempotencyKey) {
    const [savedMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.idempotencyKey, idempotencyKey))
      .limit(1);

    if (savedMessage) {
      const [agent] = await db
        .select({ xp: agentsTable.xp })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
      const { omega, analysisStatus } = evaluateAgentResponse(
        savedMessage.content,
        context,
      );
      res.json({
        response: savedMessage.content,
        conversationId: savedMessage.conversationId,
        omega,
        xp: agent?.xp ?? 0,
        analysisStatus,
      });
      return;
    }
  }

  if (agentId) {
    const remainingMs = agentCircuitBreaker.remainingMs(agentId);
    if (remainingMs > 0) {
      await db.update(agentsTable).set({
        status: "standby",
        updatedAt: new Date(),
      }).where(eq(agentsTable.id, agentId));
      res.status(503).json({
        error: "Agente en pausa de seguridad tras fallos consecutivos. Reintenta cuando termine el enfriamiento.",
        status: "standby",
        retryAfterMs: remainingMs,
      });
      return;
    }
  }

  const agentMetrics = buildAgentEvidenceMetrics(context, language);
  if (agentId) {
    await db
      .insert(agentsTable)
      .values({
        id: agentId,
        name: agentName || agentId,
        status: "active",
      })
      .onConflictDoUpdate({
        target: agentsTable.id,
        set: { name: agentName || agentId, status: "active", updatedAt: new Date() },
      });
  }

  const [conv] = await db
    .insert(conversations)
    .values({ title: message.slice(0, 60) })
    .returning();

  const systemPrompt = [
    buildAgentSystemPrompt(agentRolePrompt, agentName),
    language ? `Lenguaje analizado: ${language}.` : "",
    `Payload obligatorio del nodo: ${JSON.stringify(agentMetrics)}. Estas métricas fueron calculadas por el servidor; no las alteres.`,
    context
      ? `Código o métricas verificables para el análisis:\n\`\`\`\n${context}\n\`\`\``
      : "No se proporcionó código ni métricas verificables.",
  ]
    .filter(Boolean)
    .join("\n\n");

  await db.insert(messages).values([
    { conversationId: conv.id, role: "system", content: systemPrompt },
    { conversationId: conv.id, role: "user", content: message },
  ]);

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.id));

  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_PROVIDER_TIMEOUT_MS);
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: history.map((item) => ({
        role: item.role as "system" | "user" | "assistant",
        content: item.content,
      })),
    }, { signal: controller.signal });
    agentCircuitBreaker.recordSuccess(agentId);
  } catch (error) {
    const breaker = agentCircuitBreaker.recordFailure(agentId);
    const failure = controller.signal.aborted
      ? `El proveedor superó el límite de ${AGENT_PROVIDER_TIMEOUT_MS} ms.`
      : "El proveedor de IA no completó el análisis.";
    await db.update(agentsTable).set({
      status: breaker.remainingMs > 0 ? "standby" : "failed",
      failedAnalyses: sql`${agentsTable.failedAnalyses} + 1`,
      lastFailure: failure,
      lastOmega: null,
      updatedAt: new Date(),
    }).where(eq(agentsTable.id, agentId));
    const [neuralEvent] = await db.insert(neuralEventsTable).values({
      origin: "agents",
      eventType: breaker.remainingMs > 0 ? "cortex_recovery" : "agent_failed",
      content: `agent=${agentId}; consecutive_failures=${breaker.consecutiveFailures}; ${failure}`,
    }).returning();
    await publishNeuralEvent({
      id: neuralEvent.id,
      origin: "agents",
      eventType: neuralEvent.eventType,
      content: neuralEvent.content,
      createdAt: neuralEvent.createdAt.toISOString(),
    });
    res.status(controller.signal.aborted ? 504 : 502).json({
      error: failure,
      status: breaker.remainingMs > 0 ? "standby" : "failed",
      retryAfterMs: breaker.remainingMs,
    });
    return;
  } finally {
    clearTimeout(timeout);
  }

  const aiResponse = completion.choices[0]?.message?.content ?? "";

  const { omega, analysisStatus, failureReason } = evaluateAgentResponse(
    aiResponse,
    context,
  );
  const saved = await persistAgentResponse({
    conversationId: conv.id,
    idempotencyKey: idempotencyKey!,
    agentId,
    agentName: agentName || agentId,
    content: aiResponse,
    omega,
    analysisStatus,
    failureReason,
  });
  const finalAnalysis = saved.inserted
    ? { omega, analysisStatus }
    : evaluateAgentResponse(saved.message.content, context);

  res.json({
    response: saved.message.content,
    conversationId: saved.message.conversationId,
    omega: finalAnalysis.omega,
    xp: saved.xp,
    analysisStatus: finalAnalysis.analysisStatus,
    status: finalAnalysis.analysisStatus === "failed" ? "failed" : "completed",
    agentMetrics,
  });
});

router.post("/ai/explain", async (req, res) => {
  const parsed = AiExplainBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code, language, output } = parsed.data;

  const prompt = `Explain this ${language} code clearly and concisely. Break down what each part does, identify the logic, and point out anything notable or improvable.

Code:
\`\`\`${language}
${code}
\`\`\`
${output ? `\nProgram output:\n\`\`\`\n${output}\n\`\`\`` : ""}

Provide a clear, structured explanation. Be thorough but direct.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  res.json({ result: completion.choices[0]?.message?.content ?? "" });
});

router.post("/ai/improve", async (req, res) => {
  const parsed = AiImproveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code, language, instruction } = parsed.data;

  const prompt = `${instruction ? `Task: ${instruction}\n\n` : "Improve and optimize this code:\n\n"}Code (${language}):
\`\`\`${language}
${code}
\`\`\`

Return ONLY the improved code without any explanation or markdown code blocks — just the raw improved code.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  let result = completion.choices[0]?.message?.content ?? "";
  result = result.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "");

  res.json({ result });
});

export default router;
