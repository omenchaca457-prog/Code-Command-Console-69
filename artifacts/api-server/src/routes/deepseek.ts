import OpenAI from "openai";
import { Router, type Request, type Response } from "express";
import { DeepseekChatBody } from "@workspace/api-zod";
import { desc } from "drizzle-orm";
import { db, snippetsTable } from "@workspace/db";
import { buildDeepseekMessages } from "./deepseek-prompt";

const router = Router();

const handleDeepseekChat = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = DeepseekChatBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.prompt.trim()) {
    res.status(400).json({ error: "Escribe una pregunta válida." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "Falta configurar el secreto OPENAI_API_KEY en Replit.",
    });
    return;
  }

  const { prompt, context } = parsed.data;
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    let savedSnippets;
    try {
      savedSnippets = await db
        .select({
          title: snippetsTable.title,
          language: snippetsTable.language,
          code: snippetsTable.code,
        })
        .from(snippetsTable)
        .orderBy(desc(snippetsTable.updatedAt))
        .limit(5);
    } catch {
      throw new DatabaseContextError(
        "No se pudo cargar el contexto guardado en PostgreSQL.",
      );
    }
    const dbContext = savedSnippets
      .map(
        (snippet, index) =>
          `Snippet ${index + 1}: ${snippet.title} (${snippet.language})\n${snippet.code.slice(0, 2500)}`,
      )
      .join("\n\n");

    const deepseek = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });

    const messages = buildDeepseekMessages(prompt, context, dbContext);
    const stream = await deepseek.chat.completions.create(
      {
        model: "deepseek-coder",
        stream: true,
        max_tokens: 4096,
        messages,
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      if (controller.signal.aborted || res.destroyed) break;
      const delta = chunk.choices[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    if (!controller.signal.aborted && !res.destroyed) {
      res.write("data: [DONE]\n\n");
    }
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) {
      req.log.error({ err: error }, "Falló el flujo de DeepSeek");
      const providerStatus =
        error && typeof error === "object" && "status" in error
          ? (error as { status?: unknown }).status
          : undefined;
      const message =
        error instanceof DatabaseContextError
          ? error.message
          : providerStatus === 402
          ? "La cuenta de DeepSeek no tiene saldo disponible. Añade saldo o configura otra clave."
          : "No se pudo completar la consulta a DeepSeek.";
      res.write(
        `data: ${JSON.stringify({
          error: message,
        })}\n\n`,
      );
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
};

class DatabaseContextError extends Error {}

router.post("/deepseek/chat", handleDeepseekChat);
router.post("/chat", handleDeepseekChat);

export default router;
