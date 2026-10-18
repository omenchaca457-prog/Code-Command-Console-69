import { Router, type Request, type Response } from "express";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_SYSTEM_PROMPT =
  "Eres el ojo de la red. Investiga tendencias, resume información y da contexto general. " +
  "Sé claro cuando la respuesta dependa de información reciente que no hayas podido verificar.";
const MAX_PROMPT_LENGTH = 40_000;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type GeminiDependencies = {
  getApiKey: () => string | undefined;
  fetch: typeof fetch;
};

const defaultDependencies: GeminiDependencies = {
  getApiKey: () => process.env.GEMINI_API_KEY,
  fetch: (...args) => globalThis.fetch(...args),
};

async function handleGeminiChat(
  dependencies: GeminiDependencies,
  req: Request,
  res: Response,
) {
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Escribe una pregunta para Gemini." });
    return;
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(413).json({ error: "La pregunta supera el límite permitido." });
    return;
  }

  const apiKey = dependencies.getApiKey();
  if (!apiKey) {
    res.status(503).json({
      error: "Gemini no está configurado. Añade GEMINI_API_KEY en Secrets.",
    });
    return;
  }

  try {
    const upstream = await dependencies.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${GEMINI_SYSTEM_PROMPT}\n\nPregunta:\n${prompt.trim()}`,
            }],
          }],
        }),
      },
    );

    if (!upstream.ok) {
      req.log.error(
        { statusCode: upstream.status },
        "La solicitud a Gemini fue rechazada",
      );
      const error =
        upstream.status === 429
          ? "Gemini alcanzó el límite de solicitudes. Inténtalo de nuevo más tarde."
          : upstream.status === 401 || upstream.status === 403
            ? "Gemini rechazó la clave o no tiene permisos para este modelo."
            : "No se pudo completar la consulta a Gemini.";
      res.status(upstream.status === 429 ? 429 : 502).json({ error });
      return;
    }

    const result = await upstream.json() as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      res.status(502).json({ error: "Gemini devolvió una respuesta vacía." });
      return;
    }
    res.json({ text });
  } catch (error) {
    req.log.error({ err: error }, "Falló la consulta a Gemini");
    if (!res.headersSent) {
      res.status(502).json({ error: "No se pudo conectar con Gemini." });
    }
  }
}

export function createGeminiRouter(
  overrides: Partial<GeminiDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const router = Router();
  router.post("/gemini/chat", (req, res) =>
    handleGeminiChat(dependencies, req, res),
  );
  return router;
}

export default createGeminiRouter();
