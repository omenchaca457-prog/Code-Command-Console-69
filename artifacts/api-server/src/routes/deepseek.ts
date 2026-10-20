import { boundedContextRead } from "./deepseek-context-read.ts";
import OpenAI from "openai";
import { Router, type Request, type Response } from "express";
import {
  buildDeepseekMessages,
  filterBadRequestHistory,
  formatMessageContext,
} from "./deepseek-prompt.ts";
import {
  emitMockDeepseekStream,
  type DeepseekMockScenario,
} from "./deepseek-mock-stream.ts";
import { getWriteNotificationSummary } from "./deepseek-tools.ts";

const MAX_TOOL_ROUNDS = 10;
const MAX_TOOL_CALLS = 10;

const DEEPSEEK_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "write_project_file",
      description:
        "Aplica el código solicitado por el Arquitecto a un archivo existente del workspace. Solo escribe rutas relativas dentro del proyecto y archivos de código permitidos; nunca secretos ni archivos fuera del proyecto. Usa únicamente cuando el usuario solicite explícitamente modificar o aplicar cambios.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Ruta relativa de un archivo existente del proyecto." },
          content: { type: "string", description: "Contenido completo final del archivo, no un diff." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Alias compatible con versiones anteriores de SQ-AI. Aplica el código solicitado en un archivo de código existente; solo úsala ante una petición explícita de modificación.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Ruta relativa de un archivo existente del proyecto." },
          content: { type: "string", description: "Contenido completo final del archivo, no un diff." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
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
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_runtime_diagnostics",
      description: "Lee un resumen limitado de logs recientes del servidor y errores capturados del Webview.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workspace_snapshot",
      description: "Lee estado de PostgreSQL, XP/Ω/estado del enjambre, cantidad de snippets y métricas del proceso; nunca devuelve valores de secretos.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_library_snapshot",
      description: "Lista los últimos snippets guardados en Library.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_integrations_status",
      description: "Devuelve el snapshot manual más reciente de Integrations de Replit, con fecha de captura; nunca revela credenciales ni lo presenta como tiempo real.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "run_safe_command",
      description: "Ejecuta únicamente un comando de diagnóstico de solo lectura incluido en la lista segura.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["git_status", "git_log", "node_version", "pnpm_version", "working_directory", "project_files"],
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
];

type DeepseekChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
type DeepseekStream = AsyncIterable<DeepseekChunk>;
type DeepseekClient = {
  chat: {
    completions: {
      create: (
        request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        options: { signal: AbortSignal },
      ) => Promise<DeepseekStream>;
    };
  };
};

type DeepseekChatInput = {
  prompt: string;
  context?: string | null;
};
type DeepseekParseResult =
  | { success: true; data: DeepseekChatInput }
  | { success: false };

type DeepseekDependencies = {
  contextTimeoutMs: number;
  requestTimeoutMs: number;
  getApiKey: () => string | undefined;
  createClient: (apiKey: string) => DeepseekClient;
  parseBody: (body: unknown) => Promise<DeepseekParseResult>;
  loadHistory: () => Promise<string>;
  executeTool: (name: string, args: string) => Promise<string>;
  emitMockStream: (
    response: Response,
    signal: AbortSignal,
    scenario: DeepseekMockScenario,
  ) => Promise<void>;
};

const defaultDependencies: DeepseekDependencies = {
  contextTimeoutMs: 2000,
  requestTimeoutMs: 90_000,
  getApiKey: () => process.env.OPENAI_API_KEY,
  createClient: (apiKey) =>
    new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
      timeout: 45_000,
      maxRetries: 1,
    }) as unknown as DeepseekClient,
  parseBody: async (body) => {
    const { DeepseekChatBody } = await import("@workspace/api-zod");
    return DeepseekChatBody.safeParse(body);
  },
  loadHistory: async () => {
    const { pool } = await import("@workspace/db");
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
    return formatMessageContext(filterBadRequestHistory(rows));
  },
  executeTool: async (name, args) => {
    const { executeDeepseekTool } = await import("./deepseek-tools.ts");
    return executeDeepseekTool(name, args);
  },
  emitMockStream: emitMockDeepseekStream,
};

const handleDeepseekChat = async (
  dependencies: DeepseekDependencies,
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = await dependencies.parseBody(req.body);
  if (!parsed.success || !parsed.data.prompt.trim()) {
    res.status(400).json({ error: "Escribe una pregunta válida." });
    return;
  }

  const mockEnabled =
    process.env.DEEPSEEK_STREAM_MOCK === "1" &&
    process.env.NODE_ENV !== "production";
  const requestedMock = req.header("x-sqai-mock-scenario");
  const mockScenarios: DeepseekMockScenario[] = ["success", "tool_call", "partial_error"];
  if (
    requestedMock &&
    (!mockEnabled || !mockScenarios.includes(requestedMock as DeepseekMockScenario))
  ) {
    res.status(404).json({ error: "Modo de simulación no disponible." });
    return;
  }
  const mockScenario = requestedMock as DeepseekMockScenario | undefined;

  const apiKey = dependencies.getApiKey();
  if (!apiKey && !(mockEnabled && mockScenario)) {
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
  res.write(": connected; preparing context\n\n");
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": keep-alive\n\n");
  }, 1000);
  const requestTimeout = setTimeout(() => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(`data: ${JSON.stringify({ error: "DeepSeek superó el tiempo máximo de respuesta." })}\n\n`);
      res.end();
    }
    controller.abort();
  }, dependencies.requestTimeoutMs);
  const clearStreamTimers = () => {
    clearInterval(heartbeat);
    clearTimeout(requestTimeout);
  };
  res.once("close", clearStreamTimers);

  try {
    if (mockEnabled && mockScenario) {
      await dependencies.emitMockStream(res, controller.signal, mockScenario);
      return;
    }
    if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY.");

    const deepseek = dependencies.createClient(apiKey);
    const reads = [
      ["history", () => dependencies.loadHistory()],
      ...["get_workspace_snapshot", "get_runtime_diagnostics", "get_library_snapshot",
        "get_integrations_status", "get_neural_activity"].map(name =>
        [name, () => dependencies.executeTool(name, "{}")] as const),
    ] as const;
    const [dbContext, workspace, diagnostics, library, integrations, neural] = await Promise.all(
      reads.map(([label, read]) => boundedContextRead(read, dependencies.contextTimeoutMs, label)),
    );
    if (controller.signal.aborted) return;
    const systemContext = [
      context ?? "",
      "[ESTADO REAL DEL SISTEMA]",
      `workspace/database/process: ${workspace.slice(0, 8000)}`,
      `server/webview logs: ${diagnostics.slice(-6000)}`,
      `library: ${library.slice(0, 6000)}`,
      `integration status: ${integrations.slice(0, 12000)}`,
      `neural activity: ${neural.slice(0, 5000)}`,
    ].join("\n\n");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      buildDeepseekMessages(prompt, systemContext, dbContext);
    const notificationSummaries = new Set<string>();
    let toolCallsExecuted = 0;
    let completed = false;
    let emptyRetries = 0;

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
        max_tokens: 8192,
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
      let truncated = false;
      const pendingCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();

      for await (const chunk of stream) {
        if (controller.signal.aborted || res.destroyed) break;
        const delta = chunk.choices[0]?.delta;
        if (chunk.choices[0]?.finish_reason === "length") truncated = true;
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
      if (truncated) {
        res.write(`data: ${JSON.stringify({ error: "DeepSeek alcanzó el límite de salida. La respuesta es parcial; Cortex usará el otro agente para la coordinación." })}\n\n`);
        completed = true;
        break;
      }
      if (calls.length === 0) {
        if (!assistantText.trim()) {
          if (emptyRetries++ === 0 && !forceSynthesis) continue;
          res.write(`data: ${JSON.stringify({ error: "DeepSeek devolvió una respuesta vacía tras reintentar. Cortex continuará con el otro agente." })}\n\n`);
        }
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
        const result = await dependencies.executeTool(
          call.function.name,
          call.function.arguments,
        );
        const notificationSummary = getWriteNotificationSummary(result);
        if (notificationSummary) notificationSummaries.add(notificationSummary);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      if (completed) break;
    }

    if (!controller.signal.aborted && !res.destroyed) {
      for (const summary of notificationSummaries) {
        res.write(`data: ${JSON.stringify({ delta: `\n\n${summary}` })}\n\n`);
      }
    }
    if (!completed && !controller.signal.aborted && !res.destroyed) {
      res.write(
        `data: ${JSON.stringify({ error: "No se pudo completar el ciclo de herramientas." })}\n\n`,
      );
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
        providerStatus === 402
          ? "La cuenta de DeepSeek no tiene saldo disponible. Añade saldo o configura otra clave."
          : "No se pudo completar la consulta a DeepSeek.";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
  } finally {
    clearStreamTimers();
    if (!res.writableEnded) res.end();
  }
};

export function createDeepseekRouter(
  overrides: Partial<DeepseekDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const router = Router();
  const handler = (req: Request, res: Response) =>
    handleDeepseekChat(dependencies, req, res);

  router.post("/deepseek/chat", handler);
  router.post("/chat", handler);
  return router;
}

export default createDeepseekRouter();
