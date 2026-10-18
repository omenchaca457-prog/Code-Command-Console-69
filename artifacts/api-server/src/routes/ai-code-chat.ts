import { Router, type Request, type Response } from "express";

type AiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type AiChatBody = {
  message: string;
  context?: string | null;
  language?: string | null;
  agentId?: string;
};

type ParseResult =
  | { success: true; data: AiChatBody }
  | { success: false };

export type AiCodeCompletionResult = {
  choices: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function" | string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
};

export const AI_CODE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "write_project_file",
      description:
        "Escribe el contenido final en un archivo de código existente del workspace. Invócala únicamente cuando el usuario pida explícitamente aplicar o guardar cambios. No uses rutas absolutas, archivos sensibles ni rutas fuera del proyecto.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Ruta relativa de un archivo existente." },
          content: { type: "string", description: "Contenido completo final del archivo." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description:
        "Alias compatible con versiones anteriores de SQ-AI. Escribe el contenido completo en un archivo de código existente; úsalo solo cuando el usuario pida aplicar cambios.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Ruta relativa de un archivo existente." },
          content: { type: "string", description: "Contenido completo final del archivo." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
];

export type AiCodeChatDependencies = {
  parseBody: (body: unknown) => ParseResult;
  prepareConversation: (
    message: string,
    systemPrompt: string,
  ) => Promise<{ conversationId: number; history: AiChatMessage[] }>;
  saveAssistantResponse: (conversationId: number, content: string) => Promise<void>;
  createCompletion: (
    messages: AiChatMessage[],
    tools: typeof AI_CODE_TOOLS | undefined,
  ) => Promise<AiCodeCompletionResult>;
  executeTool: (name: string, argumentsJson: string) => Promise<string>;
};

export async function handleAiCodeChat(
  dependencies: AiCodeChatDependencies,
  body: AiChatBody,
  res: Response,
): Promise<void> {
  const { message, context, language } = body;
  const systemPrompt = `You are an elite AI coding assistant inside DevTerminal — a professional developer tool. You help with code, debugging, explanations, algorithms, security concepts, and any programming topic.
${language ? `Current language context: ${language}.` : ""}
${context ? `Code context:\n\`\`\`\n${context}\n\`\`\`` : ""}
When the user explicitly asks you to modify or apply code, inspect the current source and use write_project_file with the complete final content. Only existing code files inside the workspace can be changed. Do not modify secrets or run arbitrary shell commands. Otherwise, answer normally.
Be direct, concise, and technically precise. Format code blocks with language tags. Think like a senior engineer.`;

  const { conversationId, history } = await dependencies.prepareConversation(
    message,
    systemPrompt,
  );
  let completion = await dependencies.createCompletion(history, AI_CODE_TOOLS);

  for (let round = 0; round < 4; round += 1) {
    const assistantMessage = completion.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls ?? [];
    if (!toolCalls.length) break;

    history.push({
      role: "assistant",
      content: assistantMessage?.content ?? null,
      tool_calls: toolCalls.flatMap((toolCall) =>
        toolCall.type === "function"
          ? [{
              id: toolCall.id,
              type: "function" as const,
              function: toolCall.function,
            }]
          : [],
      ),
    });
    for (const toolCall of toolCalls) {
      const result =
        toolCall.type !== "function" ||
        !["write_project_file", "write_file"].includes(toolCall.function.name)
          ? JSON.stringify({ error: "Herramienta no permitida." })
          : await dependencies.executeTool(
              toolCall.function.name,
              toolCall.function.arguments,
            );
      history.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
    completion = await dependencies.createCompletion(history, AI_CODE_TOOLS);
  }

  const response = completion.choices[0]?.message?.content ?? "";
  await dependencies.saveAssistantResponse(conversationId, response);
  res.json({ response, conversationId });
}

export function createAiCodeChatRouter(dependencies: AiCodeChatDependencies) {
  const router = Router();
  router.post("/ai/chat", (req: Request, res: Response, next) => {
    const parsed = dependencies.parseBody(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    if (parsed.data.agentId) {
      next();
      return;
    }
    void handleAiCodeChat(dependencies, parsed.data, res).catch(next);
  });
  return router;
}
