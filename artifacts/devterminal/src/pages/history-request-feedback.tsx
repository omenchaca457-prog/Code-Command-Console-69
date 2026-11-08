import React, { type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

type HistoryRequestStatus = {
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
};

export function HistoryRefreshButton({
  isError,
  isFetching,
  onRefresh,
}: Pick<HistoryRequestStatus, "isError" | "isFetching"> & {
  onRefresh: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="button-refresh-history"
      onClick={onRefresh}
      disabled={isFetching}
      className="inline-flex min-h-9 items-center gap-2 border border-white/10 px-3 font-mono text-[9px] uppercase tracking-wider text-[#9eabb5] transition hover:border-[#00f0ff]/40 hover:text-[#00f0ff] disabled:opacity-50"
    >
      <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
      {isFetching ? "Consultando…" : isError ? "Reintentar" : "Actualizar"}
    </button>
  );
}

export function HistoryRequestFeedback({
  isError,
  isFetching,
  isLoading,
  itemCount,
  children,
}: HistoryRequestStatus & { itemCount: number | undefined; children?: ReactNode }) {
  return (
    <>
      {isError && (
        <p role="alert" data-testid="status-history-error" className="px-5 py-4 text-sm text-[#ff9ba9]">
          No se pudo cargar el historial.{" "}
          {itemCount !== undefined
            ? "Los registros mostrados pueden estar desactualizados. "
            : "No se pudo confirmar si hay registros guardados. "}
          Pulsa Reintentar para volver a consultar.
        </p>
      )}
      {(isLoading || (isError && isFetching)) && (
        <p role="status" data-testid="status-history-loading" className="px-5 py-8 text-center font-mono text-xs text-[#84909b]">
          Consultando registros…
        </p>
      )}
      {!isLoading && !isError && itemCount === 0 && (
        <p data-testid="status-history-empty" className="px-5 py-8 text-center text-sm text-[#84909b]">
          Todavía no hay muestras guardadas.
        </p>
      )}
      {!!itemCount && children}
    </>
  );
}
