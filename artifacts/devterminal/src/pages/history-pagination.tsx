import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HistoryPaginationProps = {
  page: number;
  pageCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
};

export function HistoryPagination({
  page,
  pageCount,
  isFetching,
  onPageChange,
}: HistoryPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] px-5 py-3 sm:px-6">
      <span className="font-mono text-[10px] text-[#75818d]" data-testid="text-history-page">
        Página {page} de {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="button-history-previous"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isFetching}
          aria-label="Página anterior del historial"
          className="inline-flex min-h-9 items-center gap-1 border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[.1em] text-[#a4b1bc] transition hover:border-[#00f0ff]/40 hover:text-[#00f0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f0ff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
        </button>
        <button
          type="button"
          data-testid="button-history-next"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount || isFetching}
          aria-label="Página siguiente del historial"
          className="inline-flex min-h-9 items-center gap-1 border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[.1em] text-[#a4b1bc] transition hover:border-[#00f0ff]/40 hover:text-[#00f0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f0ff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
