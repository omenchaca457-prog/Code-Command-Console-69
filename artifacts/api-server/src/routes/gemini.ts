import { Router, type Request, type Response } from "express";
import { loadTexasWeather } from "./weather-probe.ts";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_SYSTEM_PROMPT =
  "Eres el ojo de la red. Investiga tendencias, resume información y da contexto general. " +
  "Sé claro cuando la respuesta dependa de información reciente que no hayas podido verificar.";
const MAX_PROMPT_LENGTH = 40_000;

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type GeminiDependencies = {
  getApiKey: () => string | undefined;
  fetch: typeof fetch;
  loadWeather: () => Promise<unknown>;
};

const defaultDependencies: GeminiDependencies = {
  getApiKey: () => process.env.GEMINI_API_KEY,
  fetch: (...args) => globalThis.fetch(...args),
  loadWeather: loadTexasWeather,
};

async function handleGeminiChat(
  dependencies: GeminiDependencies,
  req: Request,
  res: Response,
) {
  const prompt = req.body?.prompt;
  const context = typeof req.body?.context === "string" ? req.body.context : "";
  if (context.length > 60_000) {
    res.status(413).json({ error: "El contexto supera 60000 caracteres; no se enviará truncado a Gemini." });
    return;
  }
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

  let weather: unknown;
  try {
    weather = await dependencies.loadWeather();
  } catch (error) {
    req.log.error({ err: error }, "Sonda Open-Meteo no disponible");
    weather = { source: "Open-Meteo", unavailable: true, note: "No inferir el clima actual." };
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
  if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 750));
  try {
    const upstream = await dependencies.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          generationConfig: { maxOutputTokens: attempt === 0 ? 16_384 : 32_768 },
          contents: [{
            parts: [{
              text: `${GEMINI_SYSTEM_PROMPT}\n\nContexto real recopilado de la terminal:\n${context || "(no se proporcionó contexto)"}\n\nSonda meteorológica por defecto (úsala solo si es relevante; no es la ubicación del usuario):\n${JSON.stringify(weather)}\n\nPregunta:\n${prompt.trim()}`,
            }],
          }],
        }),
      },
    );

    if (!upstream.ok) {
      if (upstream.status >= 500 && attempt === 0) {
        await upstream.body?.cancel();
        continue;
      }
      req.log.error(
        { statusCode: upstream.status },
        "La solicitud a Gemini fue rechazada",
      );
      const error =
        upstream.status === 429
          ? "Gemini alcanzó el límite de solicitudes. Inténtalo de nuevo más tarde."
          : upstream.status === 401 || upstream.status === 403
            ? "Gemini rechazó la clave o no tiene permisos para este modelo."
            : upstream.status >= 500
              ? "Gemini está temporalmente no disponible tras reintentar. Cortex continuará con el otro agente."
              : "No se pudo completar la consulta a Gemini.";
      res.status(upstream.status === 429 ? 429 : 502).json({ error });
      return;
    }

    const result = await upstream.json() as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    const finishReason = result.candidates?.[0]?.finishReason;
    if (!text || (finishReason && finishReason !== "STOP")) {
      if (attempt === 0) continue;
      res.status(502).json({ error: "Gemini devolvió una respuesta vacía o incompleta tras dos intentos. Cortex continuará con el otro agente." });
      return;
    }
    res.json({ text });
    return;
  } catch (error) {
    req.log.error({ err: error }, "Falló la consulta a Gemini");
    if (attempt === 0) continue;
    if (!res.headersSent) {
      res.status(502).json({ error: "No se pudo conectar con Gemini." });
    }
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
