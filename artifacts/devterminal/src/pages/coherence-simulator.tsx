import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, Clock3, Cpu, Gauge, LoaderCircle, Radio, RefreshCw, Square, Triangle } from "lucide-react";
import { useNeuralContext } from "@/lib/neural-context";

type Sample = {
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  timestamp: string;
};

type SimulationStatus = {
  running: boolean;
  vectorsProcessed: number;
  latest: Sample | null;
};

type SimulationLog = {
  id: number;
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  createdAt: string;
};

type SimulationLogPage = {
  items: SimulationLog[];
  nextBeforeId: number | null;
};

const EMPTY_STATUS: SimulationStatus = {
  running: false,
  vectorsProcessed: 0,
  latest: null,
};

async function requestControl(action: "start" | "stop"): Promise<SimulationStatus> {
  const response = await fetch(`/api/coherence-simulation/${action}`, { method: "POST" });
  if (!response.ok) throw new Error(`No se pudo ${action === "start" ? "iniciar" : "detener"} el simulador (HTTP ${response.status}).`);
  return response.json() as Promise<SimulationStatus>;
}

export default function CoherenceSimulator() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SimulationLog[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const lastAboveThreshold = useRef(false);
  const { recordEvent } = useNeuralContext();
  const recordEventRef = useRef(recordEvent);

  const loadHistory = useCallback(async (beforeId?: number) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (beforeId !== undefined) params.set("beforeId", String(beforeId));
      const response = await fetch(`/api/coherence-simulation/logs?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = await response.json() as SimulationLogPage;
      setHistory((current) => {
        if (beforeId !== undefined) {
          const knownIds = new Set(current.map((item) => item.id));
          return [...current, ...page.items.filter((item) => !knownIds.has(item.id))];
        }
        return page.items;
      });
      setHistoryCursor(page.nextBeforeId);
    } catch {
      setHistoryError("No se pudo cargar el historial guardado.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    recordEventRef.current = recordEvent;
  }, [recordEvent]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/coherence-simulation/status")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SimulationStatus>;
      })
      .then((current) => {
        if (alive) {
          setStatus(current);
          lastAboveThreshold.current = (current.latest?.coherence ?? 0) > 95;
        }
      })
      .catch(() => {
        if (alive) setError("No se pudo consultar el estado del simulador.");
      });

    const source = new EventSource("/api/coherence-simulation/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("status", (event) => {
      if (!alive) return;
      const next = JSON.parse((event as MessageEvent<string>).data) as SimulationStatus;
      setStatus(next);
      lastAboveThreshold.current = (next.latest?.coherence ?? 0) > 95;
    });
    source.addEventListener("sample", (event) => {
      if (!alive) return;
      const sample = JSON.parse((event as MessageEvent<string>).data) as Sample;
      setStatus((current) => ({ ...current, running: true, vectorsProcessed: sample.vectorsProcessed, latest: sample }));
      if (sample.vectorsProcessed % 100 === 0) {
        window.setTimeout(() => {
          if (alive) void loadHistory();
        }, 350);
      }

      const isAboveThreshold = sample.coherence > 95;
      if (isAboveThreshold && !lastAboveThreshold.current) {
        recordEventRef.current({
          origin: "motor",
          eventType: "high_coherence",
          content: `ALTA COHERENCIA: ${sample.coherence.toFixed(4)}% · vector ${sample.vectorsProcessed}`,
        });
      }
      lastAboveThreshold.current = isAboveThreshold;
    });

    return () => {
      alive = false;
      source.close();
    };
  }, [loadHistory]);

  const control = useCallback(async (action: "start" | "stop") => {
    setBusy(true);
    setError("");
    try {
      const next = await requestControl(action);
      setStatus(next);
      if (action === "stop") lastAboveThreshold.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al controlar el simulador.");
    } finally {
      setBusy(false);
    }
  }, []);

  const coherence = status.latest?.coherence ?? 0;
  const turbulence = status.latest?.turbulence ?? "—";
  const vector = status.latest?.vector ?? "—";

  return (
    <main className="relative h-full overflow-y-auto bg-[#080b10] text-[#eef3f8]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{
        backgroundImage: "linear-gradient(rgba(0,240,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,.035) 1px,transparent 1px)",
        backgroundSize: "38px 38px",
        maskImage: "linear-gradient(to bottom, black, transparent 85%)",
      }} />
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-[#00f0ff]">
              <Activity className="h-3.5 w-3.5" aria-hidden /> DevTerminal / Simulación sintética
            </div>
            <h1 className="font-mono text-3xl font-bold tracking-[-.06em] sm:text-4xl">MOTOR 5.5<span className="text-[#00f0ff]">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8794a1]">Flujo de vectores aleatorios para observar coherencia y turbulencia en tiempo real.</p>
          </div>
          <div className="flex items-center gap-2 border border-white/10 bg-white/[.025] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-[#a4b1bc]">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]" : "bg-[#ff526e]"}`} />
            SSE {connected ? "CONECTADO" : "RECONECTANDO"}
          </div>
        </header>

        {error && <p role="alert" className="mb-5 border border-[#ff526e]/30 bg-[#ff526e]/[.06] px-4 py-3 text-sm text-[#ff9ba9]">{error}</p>}

        <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="border border-white/10 bg-[#0c1118] p-5 sm:p-7">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center border border-[#00f0ff]/25 bg-[#00f0ff]/[.07] text-[#00f0ff]"><Cpu className="h-5 w-5" /></div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#00f0ff]">Estado del motor</p>
                  <p className="mt-1 text-sm font-medium">{status.running ? "Procesando vectores" : "En espera"}</p>
                </div>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-[#75818d]">{status.vectorsProcessed.toLocaleString()} VECTORES</span>
            </div>

            <div className="mb-2 flex items-end justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#84909b]">Coherencia</span>
              <span className="font-mono text-3xl font-bold tabular-nums text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,240,255,.25)]">{coherence.toFixed(2)}<span className="text-base">%</span></span>
            </div>
            <div
              className="h-3 overflow-hidden border border-[#00f0ff]/20 bg-[#06090d]"
              role="progressbar"
              aria-label="Coherencia"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coherence}
            >
              <div className="h-full bg-gradient-to-r from-[#007c91] to-[#00f0ff] shadow-[0_0_18px_rgba(0,240,255,.45)] transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, coherence))}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] text-[#586570]"><span>0%</span><span>UMBRAL NEURAL 95%</span><span>100%</span></div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void control("start")}
                disabled={busy || status.running}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#00f0ff] px-5 font-mono text-xs font-bold uppercase tracking-[.12em] text-[#061014] transition hover:bg-[#8affff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f0ff] disabled:cursor-not-allowed disabled:bg-[#26363a] disabled:text-[#76888b]"
              >
                <Triangle className="h-4 w-4 fill-current" /> {busy && !status.running ? "Iniciando…" : "Iniciar motor"}
              </button>
              <button
                type="button"
                onClick={() => void control("stop")}
                disabled={busy || !status.running}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#ff526e]/35 bg-[#ff526e]/[.06] px-5 font-mono text-xs font-bold uppercase tracking-[.12em] text-[#ff8295] transition hover:bg-[#ff526e]/[.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff526e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Square className="h-3.5 w-3.5 fill-current" /> Detener motor
              </button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <article className="border border-white/10 bg-[#0c1118] p-5">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#ffb84d]"><Gauge className="h-4 w-4" /> Turbulencia actual</div>
              <p className="break-all font-mono text-2xl font-semibold tabular-nums text-[#ffbf69]">{turbulence}</p>
              <p className="mt-2 text-xs text-[#75818d]">Residuo del vector sintético módulo 410542503</p>
            </article>
            <article className="border border-white/10 bg-[#0c1118] p-5">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#8f9ca8]"><Radio className="h-4 w-4 text-[#00f0ff]" /> Vector actual</div>
              <p className="break-all font-mono text-sm leading-6 text-[#cbd4dc]">{vector}</p>
              <p className="mt-3 font-mono text-[10px] text-[#596672]">{status.latest ? new Date(status.latest.timestamp).toLocaleTimeString() : "Esperando datos"}</p>
            </article>
          </div>
        </section>

        <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/[.07] pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#626f7a]">
          <span>Vector aleatorio · intervalo 100 ms</span>
          <span>Persistencia sintética cada 10 s · Neural: {coherence > 95 ? "umbral alcanzado" : "en observación"}</span>
        </footer>

        <section aria-labelledby="simulation-history-title" className="mt-7 border border-white/10 bg-[#0c1118]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4 sm:px-6">
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#00f0ff]"><Clock3 className="h-3.5 w-3.5" /> Registros persistidos</div>
              <h2 id="simulation-history-title" className="text-sm font-semibold text-[#e4ebf0]">Historial de simulación</h2>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-[#9eabb5] transition hover:border-[#00f0ff]/40 hover:text-[#00f0ff] disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </header>
          {historyError && <p role="alert" className="px-5 pt-4 text-xs text-[#ff9ba9]">{historyError}</p>}
          {historyLoading && history.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-5 py-10 font-mono text-[10px] uppercase tracking-wider text-[#75818d]"><LoaderCircle className="h-4 w-4 animate-spin text-[#00f0ff]" /> Cargando historial…</div>
          ) : history.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-[#75818d]">Aún no hay registros guardados. Al iniciar el motor, se guardará una muestra cada 10 segundos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-white/[.025] font-mono text-[9px] uppercase tracking-[.12em] text-[#64717c]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Vectores</th>
                    <th className="px-5 py-3 font-medium">Coherencia</th>
                    <th className="px-5 py-3 font-medium">Turbulencia</th>
                    <th className="px-5 py-3 font-medium">Vector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.05]">
                  {history.map((item) => (
                    <tr key={item.id} className="font-mono text-[10px] text-[#aebbc5]">
                      <td className="whitespace-nowrap px-5 py-3 text-[#75818d]">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3 tabular-nums">{item.vectorsProcessed.toLocaleString()}</td>
                      <td className="px-5 py-3 tabular-nums text-[#00f0ff]">{item.coherence.toFixed(2)}%</td>
                      <td className="px-5 py-3 tabular-nums text-[#ffbf69]">{item.turbulence}</td>
                      <td className="max-w-52 truncate px-5 py-3" title={item.vector}>{item.vector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {historyCursor !== null && (
            <div className="border-t border-white/[.07] px-5 py-3 text-center">
              <button
                type="button"
                onClick={() => void loadHistory(historyCursor)}
                disabled={historyLoading}
                className="inline-flex items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-[#8d9aa5] transition hover:text-[#00f0ff] disabled:opacity-50"
              >
                <ChevronDown className="h-3.5 w-3.5" /> {historyLoading ? "Cargando…" : "Cargar registros anteriores"}
              </button>
            </div>
          )}
          <div className="border-t border-white/[.05] px-5 py-2 font-mono text-[9px] text-[#586570]">
            {history.length} registros cargados · ordenados del más reciente al más antiguo
          </div>
        </section>
      </div>
    </main>
  );
}
