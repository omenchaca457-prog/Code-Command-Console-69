import { Router } from "express";
import type OpenAI from "openai";
import { db, conversations, messages, agentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc, sql } from "drizzle-orm";
import { AiChatBody, AiExplainBody, AiImproveBody } from "@workspace/api-zod";
import { persistAgentResponse } from "./agent-message-persistence";
import {
  buildAgentEvidenceMetrics,
  buildAgentSystemPrompt,
  evaluateAgentResponse,
} from "./agent-evaluation";
import { AgentCircuitBlockedError, AgentTaskValidationError } from "./agent-circuit-breaker";
import { agentSwarmCircuit } from "./agent-swarm-circuit";
import { validateAgentOutput } from "./agent-safety-validation";
import {
  AI_CODE_TOOLS,
  createAiCodeChatRouter,
  type AiCodeCompletionResult,
} from "./ai-code-chat";

const router = Router();
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

  try {
    const result = await agentSwarmCircuit.execute(agentId, async () => {
      const agentMetrics = buildAgentEvidenceMetrics(context, language);
      if (agentSwarmCircuit.getSnapshot(agentId).state === "HALF-OPEN" && !agentMetrics.evidence_available) {
        throw new AgentTaskValidationError("La auditoría de recuperación requiere código o métricas verificables.");
      }
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
      } catch (error) {
        if (controller.signal.aborted) {
          throw new AgentTaskValidationError(`El proveedor superó el límite de ${AGENT_PROVIDER_TIMEOUT_MS} ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const aiResponse = completion.choices[0]?.message?.content ?? "";
      const { omega, analysisStatus, failureReason } = validateAgentOutput(
        aiResponse,
        completion.choices[0]?.finish_reason ?? null,
        context,
        language,
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

      return {
        response: saved.message.content,
        conversationId: saved.message.conversationId,
        omega: finalAnalysis.omega,
        xp: saved.xp,
        analysisStatus: finalAnalysis.analysisStatus,
        status: finalAnalysis.analysisStatus === "failed" ? "failed" : "completed",
        agentMetrics,
      };
    });
    res.json(result);
  } catch (error) {
    const circuit = agentSwarmCircuit.getSnapshot(agentId);
    const blocked = error instanceof AgentCircuitBlockedError;
    const failure = blocked
      ? error.message
      : circuit.lastFailure ?? "La ejecución del agente no superó la validación.";
    req.log.warn({ agentId, circuit, blocked }, "Agent Swarm: tarea detenida");
    if (!blocked) {
      await db.update(agentsTable).set({
        status: circuit.state === "OPEN" ? "standby" : "failed",
        failedAnalyses: sql`${agentsTable.failedAnalyses} + 1`,
        lastFailure: failure,
        lastOmega: null,
        updatedAt: new Date(),
      }).where(eq(agentsTable.id, agentId));
    }
    if (blocked && circuit.remainingMs > 0) {
      res.setHeader("Retry-After", Math.ceil(circuit.remainingMs / 1000));
    }
    res.status(blocked ? 503 : 502).json({
      error: failure,
      status: blocked || circuit.state === "OPEN" ? "standby" : "failed",
      retryAfterMs: circuit.remainingMs,
    });
  }
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
