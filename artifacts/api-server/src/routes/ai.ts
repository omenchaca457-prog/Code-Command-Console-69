import { Router } from "express";
import { db, conversations, messages, agentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc, sql } from "drizzle-orm";
import { AiChatBody, AiExplainBody, AiImproveBody } from "@workspace/api-zod";
import {
  buildAgentSystemPrompt,
  classifyAgentAnalysis,
  hasAgentEvidence,
  parseOmega,
} from "./agent-evaluation";

const router = Router();

router.get("/agents", async (_req, res) => {
  const records = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      xp: agentsTable.xp,
      failedAnalyses: agentsTable.failedAnalyses,
      omega: agentsTable.lastOmega,
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

  const { message, context, language, agentId, agentName, agentRolePrompt } =
    parsed.data;
  if (agentId && !/^[a-z0-9_-]{1,64}$/.test(agentId)) {
    res.status(400).json({ error: "Identificador de agente inválido." });
    return;
  }

  const [conv] = await db
    .insert(conversations)
    .values({ title: message.slice(0, 60) })
    .returning();

  const systemPrompt = agentId
    ? [
        buildAgentSystemPrompt(agentRolePrompt, agentName),
        language ? `Lenguaje analizado: ${language}.` : "",
        context
          ? `Código o métricas verificables para el análisis:\n\`\`\`\n${context}\n\`\`\``
          : "No se proporcionó código ni métricas verificables.",
      ]
        .filter(Boolean)
        .join("\n\n")
    : `You are an elite AI coding assistant inside DevTerminal — a professional developer tool. You help with code, debugging, explanations, algorithms, security concepts, and any programming topic.
${language ? `Current language context: ${language}.` : ""}
${context ? `Code context:\n\`\`\`\n${context}\n\`\`\`` : ""}
Be direct, concise, and technically precise. Format code blocks with language tags. Think like a senior engineer.`;

  await db.insert(messages).values([
    { conversationId: conv.id, role: "system", content: systemPrompt },
    { conversationId: conv.id, role: "user", content: message },
  ]);

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.id));

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: history.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    })),
  });

  const aiResponse = completion.choices[0]?.message?.content ?? "";

  await db.insert(messages).values({
    conversationId: conv.id,
    role: "assistant",
    content: aiResponse,
  });

  if (!agentId) {
    res.json({ response: aiResponse, conversationId: conv.id });
    return;
  }

  const parsedOmega = parseOmega(aiResponse);
  const hasEvidence = hasAgentEvidence(context);
  const omega = hasEvidence ? parsedOmega : Math.min(parsedOmega ?? 0, 0.49);
  const analysisStatus = classifyAgentAnalysis(omega, hasEvidence);
  const failureReason =
    analysisStatus === "failed"
      ? !hasEvidence
        ? "No se proporcionó código ni métricas verificables."
        : parsedOmega === null
          ? "El agente no devolvió un índice Ω válido."
          : `Índice Ω bajo (${parsedOmega.toFixed(2)}).`
      : null;
  const [agent] = await db
    .insert(agentsTable)
    .values({
      id: agentId,
      name: agentName || agentId,
      xp: analysisStatus === "rewarded" ? 1 : 0,
      failedAnalyses: analysisStatus === "failed" ? 1 : 0,
      lastOmega: omega,
      lastFailure: failureReason,
    })
    .onConflictDoUpdate({
      target: agentsTable.id,
      set: {
        name: agentName || agentId,
        xp:
          analysisStatus === "rewarded"
            ? sql`${agentsTable.xp} + 1`
            : sql`${agentsTable.xp}`,
        failedAnalyses:
          analysisStatus === "failed"
            ? sql`${agentsTable.failedAnalyses} + 1`
            : sql`${agentsTable.failedAnalyses}`,
        lastOmega: omega,
        lastFailure: failureReason,
        updatedAt: new Date(),
      },
    })
    .returning({ xp: agentsTable.xp });

  res.json({
    response: aiResponse,
    conversationId: conv.id,
    omega,
    xp: agent?.xp ?? 0,
    analysisStatus,
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
