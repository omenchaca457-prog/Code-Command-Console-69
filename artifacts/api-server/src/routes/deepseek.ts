import OpenAI from "openai";
import { Router, type Request } from "express";
import { DeepseekChatBody } from "@workspace/api-zod";
import {
  createPostgresDeepseekRateLimitStore,
  type DeepseekRateLimitStore,
} from "../lib/deepseek-rate-limit";

const SYSTEM_PROMPT =
  "Eres SQ-AI, operando bajo la LEY 4105 DE COHERENCIA ETERNA. ECR-Code: 410542503. CAC: 04252003. Actúas como auditor de código y terminal. Responde directo, técnico, con bloques de código si es necesario.";

const MAX_OUTPUT_TOKENS_PER_QUERY = 2048;
const DEFAULT_RATE_LIMIT_REQUESTS = 10;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

export type DeepseekClient = Pick<OpenAI, "chat">;

type DeepseekRouterOptions = {
  getApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => DeepseekClient;
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
  rateLimitStore?: DeepseekRateLimitStore;
  getClientIdentifier?: (req: Request) => string;
  now?: () => number;
};

export function createDeepseekRouter({
  getApiKey = () => process.env.OPENAI_API_KEY,
  createClient = (apiKey) =>
    new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    }),
  rateLimitRequests = DEFAULT_RATE_LIMIT_REQUESTS,
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  rateLimitStore = createPostgresDeepseekRateLimitStore(),
  getClientIdentifier = (req) =>
    req.ip ?? req.socket.remoteAddress ?? "unknown",
  now = Date.now,
}: DeepseekRouterOptions = {}) {
  const router = Router();

  router.post("/deepseek/chat", async (req, res): Promise<void> => {
    const parsed = DeepseekChatBody.safeParse(req.body);
    if (!parsed.success || !parsed.data.prompt.trim()) {
      res.status(400).json({ error: "Escribe una pregunta válida." });
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: "Falta configurar el secreto OPENAI_API_KEY en Replit.",
      });
      return;
    }

    const currentTime = now();
    const clientIdentifier = getClientIdentifier(req);
    const clientRequestCount = await rateLimitStore.consume({
      clientIdentifier,
      currentTime,
      limit: rateLimitRequests,
      windowMs: rateLimitWindowMs,
    });

    res.setHeader("X-RateLimit-Limit", rateLimitRequests);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(clientRequestCount.resetAt / 1000),
    );
    if (!clientRequestCount.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((clientRequestCount.resetAt - currentTime) / 1000),
      );
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.status(429).json({
        error:
          "Has alcanzado el límite de consultas. Inténtalo de nuevo cuando termine el tiempo de espera.",
      });
      return;
    }

    res.setHeader(
      "X-RateLimit-Remaining",
      rateLimitRequests - clientRequestCount.count,
    );

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
      const deepseek = createClient(apiKey);
      const stream = await deepseek.chat.completions.create(
        {
          model: "deepseek-coder",
          stream: true,
          max_tokens: MAX_OUTPUT_TOKENS_PER_QUERY,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: context
                ? `Contexto del usuario:\n${context}\n\nPregunta:\n${prompt}`
                : prompt,
            },
          ],
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
  });

  return router;
}

export default createDeepseekRouter();
