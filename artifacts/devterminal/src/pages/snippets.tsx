import { useState } from "react";
import { useLocation } from "wouter";
import { useListSnippets, useDeleteSnippet, getListSnippetsQueryKey, getGetRecentSnippetsQueryKey } from "@workspace/api-client-react";
import { Search, Trash2, Terminal, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Snippets() {
  const [, setLocation] = useLocation();
  const { data: snippets, isLoading } = useListSnippets();
  const deleteSnippetMutation = useDeleteSnippet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const filteredSnippets = snippets?.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.language.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this snippet?")) return;
    deleteSnippetMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
        toast({ title: "// DELETED" });
      },
      onError: () => toast({ title: "DELETE FAILED", variant: "destructive" })
    });
  };

  const openSnippet = (id: number) => setLocation(`/?snippetId=${id}`);

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="border-b border-[#ff003c]/15 bg-[#060606] px-6 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            // CODE LIBRARY
          </h1>
          <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase mt-0.5">
            {filteredSnippets.length} snippet{filteredSnippets.length !== 1 ? 's' : ''} stored
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-[#333]" />
          <input
            placeholder="SEARCH LIBRARY..."
            className="w-full bg-[#040404] border border-[#ff003c]/20 pl-8 pr-3 py-2 font-mono text-xs text-[#888] placeholder:text-[#2a2a2a] placeholder:tracking-widest focus:outline-none focus:border-[#ff003c]/50 tracking-wider uppercase"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 md:p-6">
        {isLoading ? (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-36 bg-[#0a0a0a] border border-[#111] animate-pulse" />
            ))}
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-[#1a1a1a]">
            <Terminal className="h-8 w-8 text-[#222] mb-4" />
            <p className="text-[10px] font-mono text-[#2a2a2a] tracking-widest uppercase">
              {search ? `— no results for "${search}" —` : "— library empty —"}
            </p>
            {!search && (
              <button
                onClick={() => setLocation("/")}
                className="mt-4 px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#ff003c]/60 border border-[#ff003c]/20 hover:border-[#ff003c]/50 hover:text-[#ff003c] hover:bg-[#ff003c]/5 transition-all"
              >
                GO TO WORKSPACE
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
            {filteredSnippets.map(snippet => (
              <div
                key={snippet.id}
                className="group flex flex-col border border-[#111] bg-[#060606] hover:border-[#ff003c]/25 transition-all cursor-pointer"
                onClick={() => openSnippet(snippet.id)}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#0f0f0f] bg-[#040404]">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="h-3 w-3 text-[#ff003c]/30 group-hover:text-[#ff003c]/70 flex-shrink-0 transition-colors" />
                    <span className="font-mono text-xs text-[#888] group-hover:text-[#ccc] truncate transition-colors">
                      {snippet.title}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#ff003c]/50 border border-[#ff003c]/15 px-1.5 py-0.5 flex-shrink-0 ml-2">
                    {snippet.language}
                  </span>
                </div>

                {/* Code preview */}
                <div className="flex-1 bg-black px-3 py-2.5 overflow-hidden relative" style={{ minHeight: "80px" }}>
                  <pre className="font-mono text-[11px] text-[#00ff41]/60 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                    {snippet.code}
                  </pre>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-[#0f0f0f]">
                  <span className="text-[9px] font-mono text-[#2a2a2a] tracking-wider uppercase">
                    {format(new Date(snippet.updatedAt), "MMM d, yyyy")}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(snippet.id, e)}
                      className="p-1 text-[#333] hover:text-[#ff4040] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      className="px-2 py-0.5 font-mono text-[9px] tracking-widest uppercase text-[#ff003c]/60 border border-[#ff003c]/20 hover:bg-[#ff003c]/10 hover:text-[#ff003c] transition-all"
                      onClick={(e) => { e.stopPropagation(); openSnippet(snippet.id); }}
                    >
                      OPEN
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
