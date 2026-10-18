import OpenAI from "openai";
import { Router, type Request, type Response } from "express";
import { DeepseekChatBody } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import {
  buildDeepseekMessages,
  filterBadRequestHistory,
  formatMessageContext,
} from "./deepseek-prompt";
import { executeDeepseekTool } from "./deepseek-tools";

const router = Router();
const MAX_TOOL_ROUNDS = 10;
const MAX_TOOL_CALLS = 10;

const DEEPSEEK_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description:
        "Ejecuta una consulta SELECT de solo lectura en las tablas agents, conversations, messages o snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Consulta SELECT de una sola sentencia." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_code",
      description: "Lee un archivo de código permitido usando una ruta relativa a la raíz del proyecto.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Ejemplo: artifacts/api-server/src/routes/ai.ts." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_neural_activity",
      description: "Consulta los 10 eventos más recientes de la Red Neuronal.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

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
    let dbContext = "";
    try {
      const { rows } = await pool.query<{
        role: string;
        content: string;
        created_at: Date | string;
      }>(`
        SELECT role, content, created_at
        FROM messages
        WHERE conversation_id = (SELECT MAX(id) FROM conversations)
        ORDER BY id ASC LIMIT 40;
      `);
      dbContext = formatMessageContext(filterBadRequestHistory(rows));
    } catch (dbError) {
      req.log.error({ err: dbError }, "Error leyendo la DB");
      dbContext = "Error al conectar con la base de datos.";
    }

    const deepseek = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      buildDeepseekMessages(prompt, context, dbContext);
    let toolCallsExecuted = 0;
    let completed = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const forceSynthesis = round === MAX_TOOL_ROUNDS - 1;
      const roundMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        forceSynthesis
          ? [
              ...messages,
              {
                role: "system",
                content:
                  "Esta es la ronda final. Sintetiza ahora los hallazgos y resultados de herramientas disponibles; no solicites ni ejecutes más herramientas.",
              },
            ]
          : messages;
      const request = {
        model: "deepseek-chat",
        stream: true,
        max_tokens: 4096,
        messages: roundMessages,
        tools: DEEPSEEK_TOOLS,
        tool_choice: forceSynthesis ? "none" : "auto",
        extra_body: { thinking: { type: "disabled" } },
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;
      const stream = await deepseek.chat.completions.create(
        request,
        { signal: controller.signal },
      );

      let assistantText = "";
      const pendingCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();

      for await (const chunk of stream) {
        if (controller.signal.aborted || res.destroyed) break;
        const delta = chunk.choices[0]?.delta;
        if (typeof delta?.content === "string" && delta.content.length > 0) {
          assistantText += delta.content;
          res.write(`data: ${JSON.stringify({ delta: delta.content })}\n\n`);
        }

        for (const toolDelta of delta?.tool_calls ?? []) {
          const pending = pendingCalls.get(toolDelta.index) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          pending.id += toolDelta.id ?? "";
          pending.name += toolDelta.function?.name ?? "";
          pending.arguments += toolDelta.function?.arguments ?? "";
          pendingCalls.set(toolDelta.index, pending);
        }
      }

      if (controller.signal.aborted || res.destroyed) break;

      const calls = [...pendingCalls.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, call]) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        }));

      if (calls.length === 0) {
        res.write("data: [DONE]\n\n");
        completed = true;
        break;
      }

      if (forceSynthesis) {
        res.write(
          `data: ${JSON.stringify({ error: "No se pudo completar la síntesis final. Intenta reducir el alcance de la solicitud." })}\n\n`,
        );
        completed = true;
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: calls,
      });

      for (const call of calls) {
        if (!call.id || !call.function.name) continue;
        if (toolCallsExecuted >= MAX_TOOL_CALLS) {
          res.write(
            `data: ${JSON.stringify({ error: "Se alcanzó el límite de acciones de SQ-AI." })}\n\n`,
          );
          completed = true;
          break;
        }
        toolCallsExecuted += 1;
        const result = await executeDeepseekTool(
          call.function.name,
          call.function.arguments,
        );
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }

      if (completed) break;
    }

    if (!completed && !controller.signal.aborted && !res.destroyed) {
      res.write(
        `data: ${JSON.stringify({ error: "No se pudo completar el ciclo de herramientas." })}\n\n`,
      );
    }
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) {
      req.log.error({ err: error }, "Falló el flujo de DeepSeek");
      const providerStatus =
        error && typeof error === "object" && "status" in error
          ? (error as { status?: unknown }).status
          : undefined;
      const message =
        providerStatus === 402
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

router.post("/deepseek/chat", handleDeepseekChat);
router.post("/chat", handleDeepseekChat);

export default router;
