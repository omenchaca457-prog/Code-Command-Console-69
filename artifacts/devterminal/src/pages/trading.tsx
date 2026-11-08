import React from "react";
import { TrendingUp } from "lucide-react";
import { getGetTradingStatusQueryKey, useGetTradingStatus } from "@workspace/api-client-react";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GREEN = "#00ff41";
const RED = "#ff003c";
const CYAN = "#00f0ff";

function Card({ label, children, color = CYAN }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <article className="border border-white/10 bg-[#0c1118] p-5">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[.16em]" style={{ color: CYAN }}>{label}</p>
      <div className="font-mono text-2xl font-bold tabular-nums break-words" style={{ color }}>{children}</div>
    </article>
  );
}

export default function Trading() {
  const { data, isPending, isError, isFetching } = useGetTradingStatus({
    query: {
      queryKey: getGetTradingStatusQueryKey(),
      refetchInterval: 10000,
      refetchIntervalInBackground: true,
      retry: 3,
      retryDelay: (n: number) => Math.min(1000 * 2 ** n, 8000),
    },
    request: { cache: "no-store" },
  });

  const loading = isPending && !data;
  const unknown = !data;
  const stale = isError && !!data;
  const d = data;

  const online = d ? ["online", "running", "active"].includes(d.status.trim().toLowerCase()) : false;
  const pnlColor = !d ? "#586570" : d.pnl > 0 ? GREEN : d.pnl < 0 ? RED : "#cbd4dc";
  const pos = d ? (d.position === 1 ? { t: "1 LONG", c: GREEN } : d.position === -1 ? { t: "-1 SHORT", c: RED } : { t: "0 FLAT (en espera)", c: "#cbd4dc" }) : null;
  const dash = "---";
  const ph = loading ? <span className="inline-block h-7 w-28 animate-pulse bg-white/10" aria-label="cargando" /> : dash;

  return (
    <main className="relative h-full overflow-y-auto bg-[#080b10] text-[#eef3f8]">
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em]" style={{ color: CYAN }}>
              <TrendingUp className="h-3.5 w-3.5" aria-hidden /> DevTerminal / Monitor de solo lectura
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-[-.04em] sm:text-4xl">MÁQUINA 4105 // TRADING</h1>
          </div>
          <div className="flex items-center gap-2 border border-white/10 bg-white/[.025] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em]" role="status">
            {loading ? (
              <span className="text-[#75818d]">CONECTANDO...</span>
            ) : unknown ? (
              <span style={{ color: RED }}>DESCONECTADO / ESTADO DESCONOCIDO</span>
            ) : stale ? (
              <span style={{ color: "#ffbf69" }}>DATOS OBSOLETOS (STALE)</span>
            ) : (
              <span className="text-[#a4b1bc]">{isFetching ? "ACTUALIZANDO" : "SYNC 10 s"}</span>
            )}
          </div>
        </header>

        {isError && (
          <p role="alert" className="mb-5 border border-[#ff003c]/30 bg-[#ff003c]/[.06] px-4 py-3 font-mono text-sm text-[#ff7a92]">
            {stale
              ? "Error al actualizar: se muestran los ultimos datos recibidos, pueden estar obsoletos. Reintentando."
              : "No se pudo conectar con /api/trading-status. Estado desconocido. Reintentando."}
          </p>
        )}

        {d?.paused && (
          <p role="alert" className="mb-5 border border-[#ff003c]/50 bg-[#ff003c]/10 px-4 py-3 font-mono text-sm font-bold" style={{ color: RED }}>
            ⏸ CAPITAL &lt; $50 - BOT PAUSADO
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Bot" color={unknown ? "#586570" : online ? GREEN : RED}>
            {unknown ? (loading ? ph : "DESCONOCIDO") : stale ? `${online ? "ONLINE" : "OFFLINE"} (stale)` : online ? "ONLINE" : "OFFLINE"}
          </Card>
          <Card label="Capital">{d ? usd.format(d.capital) : ph}</Card>
          <Card label="PnL" color={pnlColor}>
            {d ? `${d.pnl > 0 ? "+" : d.pnl < 0 ? "-" : ""}${usd.format(Math.abs(d.pnl))}` : ph}
          </Card>
          <Card label="Winrate">{d ? `${d.winrate.toFixed(1)}%` : ph}</Card>
          <Card label="Trades / Wins / Losses">
            {d ? (
              <>
                {d.trades} <span className="text-base text-[#75818d]">/</span> <span style={{ color: GREEN }}>{d.wins}W</span>{" "}
                <span className="text-base text-[#75818d]">/</span> <span style={{ color: RED }}>{d.losses}L</span>
              </>
            ) : ph}
          </Card>
          <Card label="Posicion" color={pos?.c ?? "#586570"}>{pos ? pos.t : ph}</Card>
        </section>

        <footer className="mt-6 border-t border-white/[.07] pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#626f7a]">
          Solo lectura · sondeo cada 10 s · sin controles de operacion
        </footer>
      </div>
    </main>
  );
}
