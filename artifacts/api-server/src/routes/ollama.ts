import { Router } from "express";

const router = Router();

function isLocalHost(value: string): boolean {
  return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(value.toLowerCase());
}
const MODEL = process.env.OLLAMA_LOCAL_MODEL || "omega4105-lite";
const COHERENCE_SYSTEM = [
  "Protocolo experimental Ley 4105: prioriza coherencia, precisión, creatividad controlada y sincronización de información.",
  "Distingue datos verificados, inferencias e incertidumbre; nunca inventes resultados ni afirmes haber ejecutado herramientas.",
  "C4105=(Omega+Psi+K+P+(1-S))/5 es una métrica de software definida por el usuario, no una ley física.",
  "No afirmes que el modelo es consciente. Si faltan pruebas, dilo expresamente.",
].join("\n");
const LOCAL_URL = "http://127.0.0.1:11434/api/generate";

// The local endpoint is intentionally fixed to loopback; no caller-controlled URL.
router.post("/ollama/chat", async (req, res) => {
  if (process.env.OLLAMA_LOCAL_ENABLED !== "1") {
    res.status(503).json({ error: "OMEGA Lite local no está habilitado en este servidor." });
    return;
  }
  // Socket loopback alone is insufficient when a reverse proxy forwards remote traffic.
  const remote = req.socket.remoteAddress || "";
  const forwarded = req.headers.forwarded || req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.headers["x-forwarded-host"] || req.headers["x-forwarded-proto"];
  if (forwarded) {
    res.status(403).json({ error: "OMEGA Lite no admite solicitudes reenviadas por proxies." });
    return;
  }
  const host = req.headers.host;
  if (typeof host !== "string" || !isLocalHost(host.startsWith("[") ? host.split("]")[0] + "]" : host.split(":")[0])) {
    res.status(403).json({ error: "OMEGA Lite requiere un host local." });
    return;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string") {
    try {
      const parsed = new URL(origin);
      if (!isLocalHost(parsed.hostname)) {
        res.status(403).json({ error: "OMEGA Lite solo admite orígenes locales." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Origen de solicitud inválido." });
      return;
    }
  }
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
    res.status(403).json({ error: "OMEGA Lite solo acepta conexiones locales." });
    return;
  }
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8000) {
    res.status(400).json({ error: "La pregunta debe contener entre 1 y 8000 caracteres." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  res.once("close", () => { if (!res.writableEnded) controller.abort(); });

  try {
    const upstream = await fetch(LOCAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        system: COHERENCE_SYSTEM,
        stream: false,
        options: { num_ctx: 2048, num_predict: 256 },
      }),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      req.log?.warn?.({ provider: "ollama-local", status: upstream.status }, "Ollama local unavailable");
      res.status(502).json({ error: "OMEGA Lite no está disponible. Comprueba que Ollama esté iniciado y el modelo instalado." });
      return;
    }
    const data: unknown = await upstream.json();
    const response = typeof data === "object" && data !== null && "response" in data
      ? (data as { response?: unknown }).response : undefined;
    if (typeof response !== "string" || !response.trim()) {
      res.status(502).json({ error: "Ollama devolvió una respuesta inválida." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ model: MODEL, response });
  } catch {
    res.status(503).json({ error: "No se pudo contactar con OMEGA Lite local." });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
