import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Cpu,
  Gauge,
  History,
  Radio,
  RefreshCw,
  Square,
  Triangle,
} from "lucide-react";
import {
  getListCoherenceSimulationLogPagesQueryKey,
  useListCoherenceSimulationLogPages,
} from "@workspace/api-client-react";
import { useNeuralContext } from "@/lib/neural-context";
import { HistoryPagination } from "./history-pagination.tsx";

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

const EMPTY_STATUS: SimulationStatus = {
  running: false,
  vectorsProcessed: 0,
  latest: null,
};

const HISTORY_PAGE_SIZE = 10;
async function requestControl(action: "start" | "stop"): Promise<SimulationStatus> {
  const response = await fetch(`/api/coherence-simulation/${action}`, { method: "POST" });
  if (!response.ok) throw new Error(`No se pudo ${action === "start" ? "iniciar" : "detener"} el simulador (HTTP ${response.status}).`);
  return response.json() as Promise<SimulationStatus>;
}

export default function CoherenceSimulator() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [historyPage, setHistoryPage] = useState(1);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastAboveThreshold = useRef(false);
  const { recordEvent } = useNeuralContext();
  const recordEventRef = useRef(recordEvent);
  const historyQuery = useListCoherenceSimulationLogPages(
    { page: historyPage, pageSize: HISTORY_PAGE_SIZE },
    {
      query: {
        queryKey: getListCoherenceSimulationLogPagesQueryKey({ page: historyPage, pageSize: HISTORY_PAGE_SIZE }),
        refetchInterval: status.running ? 10_000 : false,
      },
    },
  );

  useEffect(() => {
    recordEventRef.current = recordEvent;
  }, [recordEvent]);

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
  }, []);

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
  const history = historyQuery.data;
  const historyPages = Math.max(1, Math.ceil((history?.total ?? 0) / HISTORY_PAGE_SIZE));

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

        <section className="mt-6 border border-white/10 bg-[#0c1118]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] px-5 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#00f0ff]">
                <History className="h-4 w-4" aria-hidden /> Historial guardado
              </div>
              <p className="mt-1 text-xs text-[#75818d]">
                {status.running ? "Se actualiza automáticamente mientras el motor está activo." : "Muestras persistidas en PostgreSQL."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#75818d]" data-testid="text-history-total">
                {history?.total ?? 0} REGISTROS
              </span>
              <button
                type="button"
                data-testid="button-refresh-history"
                onClick={() => void historyQuery.refetch()}
                disabled={historyQuery.isFetching}
                className="inline-flex min-h-9 items-center gap-2 border border-white/10 px-3 font-mono text-[9px] uppercase tracking-wider text-[#9eabb5] transition hover:border-[#00f0ff]/40 hover:text-[#00f0ff] disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${historyQuery.isFetching ? "animate-spin" : ""}`} aria-hidden /> Actualizar
              </button>
            </div>
          </div>

          {historyQuery.isError && (
            <p role="alert" data-testid="status-history-error" className="px-5 py-4 text-sm text-[#ff9ba9]">
              No se pudo cargar el historial. Vuelve a intentarlo más tarde.
            </p>
          )}
          {historyQuery.isLoading && (
            <p role="status" data-testid="status-history-loading" className="px-5 py-8 text-center font-mono text-xs text-[#84909b]">
              Consultando registros…
            </p>
          )}
          {!historyQuery.isLoading && !historyQuery.isError && history?.items.length === 0 && (
            <p data-testid="status-history-empty" className="px-5 py-8 text-center text-sm text-[#84909b]">
              Todavía no hay muestras guardadas.
            </p>
          )}
          {!!history?.items.length && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/[.07] text-left">
                <thead className="font-mono text-[9px] uppercase tracking-[.14em] text-[#75818d]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Fecha</th>
                    <th scope="col" className="px-5 py-3 font-medium">Contador</th>
                    <th scope="col" className="px-5 py-3 font-medium">Coherencia</th>
                    <th scope="col" className="px-5 py-3 font-medium">Turbulencia</th>
                    <th scope="col" className="px-5 py-3 font-medium">Vector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.05]">
                  {history.items.map((log) => (
                    <tr key={log.id} data-testid={`row-simulation-log-${log.id}`} className="font-mono text-xs text-[#cbd4dc]">
                      <td className="whitespace-nowrap px-5 py-3 text-[#a4b1bc]">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums">{log.vectorsProcessed.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#00f0ff]">{log.coherence.toFixed(2)}%</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#ffbf69]">{log.turbulence}</td>
                      <td className="max-w-sm break-all px-5 py-3">{log.vector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <HistoryPagination
            page={historyPage}
            pageCount={historyPages}
            isFetching={historyQuery.isFetching}
            onPageChange={setHistoryPage}
          />
        </section>

        <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/[.07] pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#626f7a]">
          <span>Vector aleatorio · intervalo 100 ms</span>
          <span>Persistencia sintética cada 10 s · Neural: {coherence > 95 ? "umbral alcanzado" : "en observación"}</span>
        </footer>

      </div>
    </main>
  );
}
