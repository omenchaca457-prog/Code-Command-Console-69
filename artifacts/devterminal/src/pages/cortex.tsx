import { useState } from "react";
import { ArrowUpRight, BrainCircuit, Code2, Copy, Database, LoaderCircle, Search, Send, X } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";

type ProviderState = {
  response: string;
  loading: boolean;
  error: string;
};

const initialProviderState: ProviderState = { response: "", loading: false, error: "" };
const DEEPSEEK_CONTEXT = "Eres el núcleo lógico. Analiza datos, matemáticas y código bajo la Ley 4105.";
const CONTEXT_SOURCES = ["Editor", "Runner", "Agentes", "Library", "PostgreSQL", "Integrations", "Server Logs", "Webview Logs"];

async function readDeepSeekStream(
  prompt: string,
  onDelta: (text: string) => void,
  context: string,
) {
  const response = await fetch("/api/deepseek/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ prompt, context: `${DEEPSEEK_CONTEXT}\n\nContexto recopilado:\n${context}` }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Solicitud rechazada (${response.status}).`);
  }
  if (!response.body) throw new Error("No se recibió un flujo de respuesta.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete = false;

  const consume = (frame: string) => {
    const data = frame.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (data === "[DONE]") {
      complete = true;
      return;
    }
    const payload = JSON.parse(data) as { delta?: string; error?: string };
    if (payload.error) throw new Error(payload.error);
    if (payload.delta) onDelta(payload.delta);
  };

  while (!complete) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      consume(frame);
      if (complete) break;
    }
  }
  buffer += decoder.decode();
  if (!complete && buffer.trim()) consume(buffer);
}

async function requestGemini(prompt: string, context: string) {
  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context }),
  });
  const body = await response.json().catch(() => null) as { text?: string; error?: string } | null;
  if (!response.ok || body?.error) {
    throw new Error(body?.error || `Solicitud rechazada (${response.status}).`);
  }
  if (typeof body?.text !== "string") throw new Error("La respuesta no contiene texto.");
  return body.text;
}

function ResponsePanel({
  provider,
  tagline,
  accent,
  icon: Icon,
  state,
  onCopy,
}: {
  provider: string;
  tagline: string;
  accent: "green" | "cyan";
  icon: typeof Code2;
  state: ProviderState;
  onCopy: () => void;
}) {
  const green = accent === "green";
  const color = green ? "#00ff41" : "#00e5ff";
  return (
    <section
      aria-label={`${provider} ${tagline}`}
      className="flex min-h-[300px] flex-col border bg-[#090d0c] sm:min-h-[360px]"
      style={{ borderColor: `${color}30`, boxShadow: `inset 0 1px 0 ${color}12` }}
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: `${color}45`, background: `${color}0d`, color }}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-bold tracking-[0.12em] text-[#d4ded9]">{provider}</h2>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[#58625e]">{tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-[#58625e]">
          <span className={`h-1.5 w-1.5 rounded-full ${state.loading ? "animate-pulse" : ""}`} style={{ background: state.loading ? color : state.error ? "#ff4562" : "#3b4a43" }} />
          <span className="hidden xs:inline">{state.loading ? "PROCESANDO" : state.error ? "INTERRUMPIDO" : "LISTO"}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-5 sm:px-5 sm:py-6">
        {state.loading && (
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            {state.response ? "Recibiendo respuesta" : "Procesando consulta"}
            <span className="flex gap-1" aria-hidden="true">
              <i className="h-1 w-1 animate-pulse rounded-full bg-current" />
              <i className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:180ms]" />
              <i className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:360ms]" />
            </span>
          </div>
        )}
        {state.response ? (
          <div className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-[#b4c0b9] sm:text-[13px]">
            {state.response}
            {state.loading && <span aria-label="Escribiendo" className="ml-1 inline-block h-3.5 w-1 animate-pulse align-middle" style={{ background: color }} />}
          </div>
        ) : !state.loading && !state.error ? (
          <div className="flex flex-1 flex-col items-center justify-center py-5 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center border border-white/[0.07] bg-white/[0.02] text-[#4b5751]">
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </div>
            <p className="font-mono text-[11px] text-[#68736d]">Esperando la consulta</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#3f4944]">La respuesta aparecerá aquí</p>
          </div>
        ) : null}
        {state.error && (
          <div role="alert" className="mt-4 flex items-start gap-2 border border-[#ff4562]/20 bg-[#ff4562]/[0.05] p-3 font-mono text-[10px] leading-5 text-[#ff8798]">
            <X aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {!!state.response && !state.loading && (
          <div className="mt-auto flex justify-end pt-5">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-8 items-center gap-1.5 border border-white/[0.08] px-2.5 font-mono text-[9px] uppercase tracking-widest text-[#748078] transition-colors hover:border-white/20 hover:text-[#d3ddd6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              aria-label={`Copiar respuesta de ${provider}`}
            >
              <Copy aria-hidden="true" className="h-3 w-3" />
              Copiar
            </button>
          </div>
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#46514b] sm:px-5">
        <span>{green ? "LÓGICA / CÓDIGO" : "INVESTIGACIÓN / CONTEXTO"}</span>
        <span>{state.response ? `${state.response.length} caracteres` : "Ley 4105"}</span>
      </footer>
    </section>
  );
}

export default function Cortex() {
  const { currentCode, currentLanguage } = useAppContext();
  const { events } = useNeuralContext();
  const [question, setQuestion] = useState("");
  const [deepseek, setDeepseek] = useState<ProviderState>(initialProviderState);
  const [gemini, setGemini] = useState<ProviderState>(initialProviderState);
  const [collecting, setCollecting] = useState(false);
  const [contextSources, setContextSources] = useState<string[]>([]);
  const [learningCount, setLearningCount] = useState(0);
  const busy = deepseek.loading || gemini.loading;

  const submit = async () => {
    const prompt = question.trim();
    if (!prompt || busy) return;
    setQuestion("");
    setCollecting(true);
    setDeepseek({ response: "", loading: true, error: "" });
    setGemini({ response: "", loading: true, error: "" });

    let deepseekText = "";
    let geminiText = "";
    try {
      const contextResponse = await fetch("/api/cortex/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editor: { language: currentLanguage, code: currentCode },
          activity: events.slice(0, 12).map(({ origin, eventType, content, createdAt }) => ({
            origin, eventType, content, createdAt,
          })),
        }),
      });
      const contextBody = await contextResponse.json().catch(() => null) as {
        context?: unknown; sources?: string[]; learningCount?: number; error?: string;
      } | null;
      if (!contextResponse.ok || !contextBody?.context) {
        throw new Error(contextBody?.error || "No se pudo recopilar el contexto de la terminal.");
      }
      const context = JSON.stringify(contextBody.context);
      setContextSources(contextBody.sources ?? CONTEXT_SOURCES);
      setLearningCount(contextBody.learningCount ?? 0);
      setCollecting(false);

      const deepseekTask = readDeepSeekStream(prompt, (delta) => {
        deepseekText += delta;
        setDeepseek((current) => ({ ...current, response: current.response + delta }));
      }, context).then(
        () => setDeepseek((current) => ({ ...current, loading: false })),
        (error: unknown) => setDeepseek((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Error de conexión con DeepSeek.",
        })),
      );
      const geminiTask = requestGemini(prompt, context).then(
        (text) => {
          geminiText = text;
          setGemini({ response: text, loading: false, error: "" });
        },
        (error: unknown) => setGemini((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Error de conexión con Gemini.",
        })),
      );
      await Promise.all([deepseekTask, geminiTask]);
      if (deepseekText || geminiText) {
        const saved = await fetch("/api/cortex/learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: prompt, deepseek: deepseekText, gemini: geminiText }),
        });
        if (saved.ok) setLearningCount((count) => count + 1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo recopilar el contexto.";
      setDeepseek((current) => ({ ...current, loading: false, error: message }));
      setGemini((current) => ({ ...current, loading: false, error: message }));
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-[#080b0a] text-[#cbd5ce]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(0,255,65,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,.035) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-5 pt-5 sm:px-6 sm:pt-7 lg:px-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#00ff41]/10 pb-4 sm:mb-7 sm:pb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#53615a]">
              <BrainCircuit aria-hidden="true" className="h-3.5 w-3.5 text-[#00ff41]" />
              <span>Interfaz de inteligencia paralela</span>
            </div>
            <h1 className="font-mono text-xl font-bold tracking-[0.12em] text-[#e3ebe5] sm:text-2xl sm:tracking-[0.16em]">
              CORTEX MULTI-IA 4105
            </h1>
            <p className="mt-2 max-w-2xl font-mono text-[10px] leading-5 text-[#65716a] sm:text-[11px]">
              Una pregunta. Dos núcleos especializados. Compara razonamiento y contexto en paralelo.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-[#00ff41]/15 bg-[#00ff41]/[0.035] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#83a88e]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
            {collecting ? "Recopilando contexto" : "Dos canales activos"}
          </div>
        </div>

        <section aria-label="Conexiones de contexto y memoria" className="mb-4 border border-white/[0.07] bg-[#090d0c] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-[#8c9a91]">
              <Database aria-hidden="true" className="h-3.5 w-3.5 text-[#00e5ff]" />
              Contexto multi-interfaz
            </div>
            <span className="font-mono text-[9px] text-[#56625b]">
              Memoria persistente: {learningCount} {learningCount === 1 ? "sesión" : "sesiones"} · no entrena los modelos
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(contextSources.length ? contextSources : CONTEXT_SOURCES).map((source) => (
              <span key={source} className="border border-[#00e5ff]/10 bg-[#00e5ff]/[0.025] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#71837e]">
                {source}
              </span>
            ))}
            <span className="border border-white/[0.06] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#4f5c54]">
              Integrations: snapshot manual
            </span>
          </div>
        </section>

        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#4c5851]">
          <span className="h-px w-5 bg-[#00ff41]/35" />
          Respuestas comparadas
          <span className="text-[#313a35]">/ 01—02</span>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <ResponsePanel provider="DeepSeek" tagline="Lógica y código · en streaming" accent="green" icon={Code2} state={deepseek} onCopy={() => void navigator.clipboard.writeText(deepseek.response)} />
          <ResponsePanel provider="Gemini" tagline="Investigación y contexto" accent="cyan" icon={Search} state={gemini} onCopy={() => void navigator.clipboard.writeText(gemini.response)} />
        </div>

        <form
          className="mt-4 border border-[#00ff41]/25 bg-[#060908] shadow-[0_0_24px_rgba(0,255,65,0.035)]"
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <label htmlFor="cortex-question" className="flex items-center gap-2 border-b border-white/[0.055] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.17em] text-[#718078]">
            <span className="h-1 w-1 bg-[#00ff41]" />
            Pregunta compartida
            <span className="ml-auto text-[#414b45]">Ambos canales reciben la misma consulta</span>
          </label>
          <div className="flex items-end">
            <textarea
              id="cortex-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="// Escribe una pregunta para ambas IA…"
              rows={2}
              disabled={busy}
              className="min-h-[76px] flex-1 resize-y bg-transparent px-4 py-3 font-mono text-xs leading-5 text-[#cbd5ce] placeholder:text-[#3c4640] focus:outline-none disabled:opacity-50 sm:min-h-[86px] sm:text-[13px]"
              aria-describedby="cortex-input-hint"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="m-2 flex h-10 shrink-0 items-center gap-2 bg-[#00ff41] px-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#071008] transition-colors hover:bg-[#65ff8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff41] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060908] disabled:cursor-not-allowed disabled:opacity-30 sm:px-4"
            >
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
          <div id="cortex-input-hint" className="flex justify-between border-t border-white/[0.05] px-4 py-2 font-mono text-[9px] text-[#46514a]">
            <span>ENTER para enviar <span className="mx-1 text-[#303a34]">·</span> SHIFT+ENTER para nueva línea</span>
            <span>{collecting ? "Recopilando estado de la terminal…" : busy ? "Ambas IA procesando…" : "Protocol 4105"}</span>
          </div>
        </form>
        <div aria-live="polite" className="sr-only">
          {deepseek.loading && "DeepSeek is processing"}
          {gemini.loading && "Gemini is processing"}
          {!deepseek.loading && deepseek.response && "DeepSeek response complete"}
          {!gemini.loading && gemini.response && "Gemini response complete"}
        </div>
      </div>
    </div>
  );
}
