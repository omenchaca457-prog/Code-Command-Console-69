import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square, Trash2, Plus, Download, CloudUpload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSnippet,
  useGetSnippet,
  getGetSnippetQueryKey,
  getListSnippetsQueryKey,
  getGetRecentSnippetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useNeuralContext } from "@/lib/neural-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type LangConfig = {
  id: string;
  name: string;
  color: string;
  bg: string;
  border: string;
  placeholder: string;
};

const LANGS: LangConfig[] = [
  { id: "python",     name: "python",     color: "#3b82f6", bg: "#0a0f1a", border: "#1e3a5f", placeholder: `import requests\nprint(requests.get("https://httpbin.org/ip").json())` },
  { id: "bash",       name: "bash",       color: "#22c55e", bg: "#051a0a", border: "#14532d", placeholder: `echo "=== System Info ==="\nuname -a\necho "Date: $(date)"` },
  { id: "javascript", name: "javascript", color: "#f59e0b", bg: "#1a1200", border: "#713f12", placeholder: `const data = [1,2,3,4,5]\nconst doubled = data.map(x => x * 2)\nconsole.log('Doubled:', doubled)` },
  { id: "typescript", name: "typescript", color: "#60a5fa", bg: "#0a1020", border: "#1e3a5f", placeholder: `const greet = (name: string): string => \`Hello, \${name}!\`\nconsole.log(greet("DevTerminal"))` },
  { id: "rust",       name: "rust",       color: "#f97316", bg: "#1a0800", border: "#7c2d12", placeholder: `fn main() {\n    let v: Vec<i32> = (1..=7).map(|x| x * x).collect();\n    println!("Squares: {:?}", v);\n}` },
  { id: "go",         name: "go",         color: "#06b6d4", bg: "#001a1a", border: "#164e63", placeholder: `package main\nimport "fmt"\nfunc main() {\n    for i := 1; i <= 5; i++ {\n        fmt.Printf("Line %d\\n", i)\n    }\n}` },
  { id: "c",          name: "c",          color: "#a78bfa", bg: "#0d0a1a", border: "#3b0764", placeholder: `#include <stdio.h>\nint main() {\n    for(int i=1;i<=5;i++) printf("%d\\n",i);\n    return 0;\n}` },
  { id: "cpp",        name: "c++",        color: "#c084fc", bg: "#120a1a", border: "#4a044e", placeholder: `#include <iostream>\nint main() {\n    for(int i=1;i<=5;i++) std::cout << i << "\\n";\n    return 0;\n}` },
];

type PanelStatus = "idle" | "running" | "done" | "error";

type Panel = {
  id: string;
  lang: LangConfig;
  code: string;
  output: string;
  status: PanelStatus;
  execTime: number | null;
};

let panelCounter = 0;
function makePanelId() { return `panel-${++panelCounter}`; }

function makePanel(lang: LangConfig): Panel {
  return {
    id: makePanelId(),
    lang,
    code: lang.placeholder,
    output: "",
    status: "idle",
    execTime: null,
  };
}

export default function Runner() {
  const [panels, setPanels] = useState<Panel[]>([
    makePanel(LANGS[0]),
    makePanel(LANGS[1]),
  ]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const abortRefs = useRef<Record<string, AbortController>>({});
  const loadedSnippetIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { recordEvent } = useNeuralContext();
  const queryClient = useQueryClient();
  const createSnippetMutation = useCreateSnippet();
  const [, setLocation] = useLocation();
  const snippetId = new URLSearchParams(window.location.search).get("snippetId");
  const parsedSnippetId = snippetId ? Number(snippetId) : NaN;
  const { data: loadedSnippet, isSuccess: snippetLoaded, isError: snippetLoadFailed } = useGetSnippet(parsedSnippetId, {
    query: {
      enabled: Number.isInteger(parsedSnippetId) && parsedSnippetId > 0,
      queryKey: getGetSnippetQueryKey(parsedSnippetId),
    },
  });
  const [savingPanelIds, setSavingPanelIds] = useState<Set<string>>(() => new Set());

  const updatePanel = useCallback((id: string, patch: Partial<Panel>) => {
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  useEffect(() => {
    if (!snippetId || loadedSnippetIdRef.current === snippetId) return;
    if (snippetLoadFailed) {
      loadedSnippetIdRef.current = snippetId;
      toast({ title: "No se encontró el snippet", variant: "destructive" });
      setLocation("/runner");
      return;
    }
    if (!snippetLoaded || !loadedSnippet) return;
    const lang = LANGS.find(item => item.id === loadedSnippet.language);
    if (!lang) {
      toast({ title: "No se pudo cargar", description: "El lenguaje de este snippet no está disponible en Runner.", variant: "destructive" });
    } else {
      setPanels(current => [{ ...makePanel(lang), code: loadedSnippet.code }, ...current]);
      toast({ title: "Snippet cargado en Runner", description: loadedSnippet.title });
    }
    loadedSnippetIdRef.current = snippetId;
    setLocation("/runner");
  }, [snippetId, snippetLoaded, snippetLoadFailed, loadedSnippet, setLocation, toast]);

  useEffect(() => {
    if (!snippetId) loadedSnippetIdRef.current = null;
  }, [snippetId]);

  const savePanel = useCallback((panel: Panel) => {
    if (!panel.code.trim()) {
      toast({ title: "No se pudo guardar", description: "El panel no contiene código.", variant: "destructive" });
      return;
    }
    const title = `Runner_${panel.lang.name.replace(/[^a-z0-9]+/gi, "_")}_${new Date().getFullYear()}_${Date.now()}`;
    setSavingPanelIds(current => new Set(current).add(panel.id));
    createSnippetMutation.mutate(
      { data: { title, code: panel.code, language: panel.lang.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
          toast({ title: "Snippet guardado en Library", description: title });
        },
        onError: () => toast({ title: "No se pudo guardar el snippet", variant: "destructive" }),
        onSettled: () => setSavingPanelIds(current => {
          const next = new Set(current);
          next.delete(panel.id);
          return next;
        }),
      },
    );
  }, [createSnippetMutation, queryClient, toast]);

  const runPanel = useCallback(async (panel: Panel) => {
    const ctrl = new AbortController();
    abortRefs.current[panel.id] = ctrl;
    updatePanel(panel.id, { status: "running", output: "", execTime: null });

    const start = Date.now();
    try {
      const resp = await fetch(`${BASE_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: panel.lang.id, code: panel.code }),
        signal: ctrl.signal,
      });
      const data = await resp.json();
      const execTime = (Date.now() - start) / 1000;
      const out = [data.stdout, data.stderr].filter(Boolean).join("\n");
      recordEvent({
        origin: "runner",
        eventType: "code_run",
        content: `language=${panel.lang.id}; exitCode=${data.exitCode}; codeLength=${panel.code.length}`,
      });
      updatePanel(panel.id, {
        status: data.exitCode === 0 ? "done" : "error",
        output: out || "(no output)",
        execTime,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        recordEvent({
          origin: "runner",
          eventType: "code_run_error",
          content: `language=${panel.lang.id}; execution request failed`,
        });
      }
      if (e.name === "AbortError") {
        updatePanel(panel.id, { status: "idle", output: "[STOPPED]" });
      } else {
        updatePanel(panel.id, { status: "error", output: String(e), execTime: (Date.now() - start) / 1000 });
      }
    } finally {
      delete abortRefs.current[panel.id];
    }
  }, [recordEvent, updatePanel]);

  const stopPanel = useCallback((id: string) => {
    abortRefs.current[id]?.abort();
  }, []);

  const runAll = () => panels.forEach(p => p.status !== "running" && runPanel(p));

  const installPackage = async (langId: string, pkg: string) => {
    const isNode = langId === "javascript" || langId === "typescript";
    const lang = isNode ? "javascript" : "python";
    toast({ title: `Installing ${pkg}...` });
    try {
      const resp = await fetch(`${BASE_URL}/api/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, packages: [pkg] }),
      });
      const data = await resp.json();
      toast({ title: data.exitCode === 0 ? `✓ ${pkg} installed` : `Failed: ${pkg}`, variant: data.exitCode === 0 ? "default" : "destructive" });
    } catch {
      toast({ title: "Install failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ff003c]/15 bg-[#060606]">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            ▶ RUNNER
          </h1>
          <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">{panels.length} panels active</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#22c55e] hover:bg-[#16a34a] transition-all"
            style={{ boxShadow: "0 0 12px #22c55e50" }}
          >
            <Play className="h-3 w-3 fill-current" /> RUN ALL
          </button>
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#ff003c]/70 border border-[#ff003c]/25 hover:border-[#ff003c]/60 hover:bg-[#ff003c]/5 transition-all"
            >
              <Plus className="h-3 w-3" /> ADD PANEL
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0a0a] border border-[#ff003c]/25 shadow-xl min-w-[160px]">
                {LANGS.map(l => (
                  <button
                    key={l.id}
                    className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#888] hover:bg-[#ff003c]/05 hover:text-[#ccc] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      setPanels(ps => [...ps, makePanel(l)]);
                      setShowLangPicker(false);
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {panels.map(panel => (
            <PanelCard
              key={panel.id}
              panel={panel}
              onRun={() => runPanel(panel)}
              onSave={() => savePanel(panel)}
              isSaving={savingPanelIds.has(panel.id)}
              onStop={() => stopPanel(panel.id)}
              onRemove={() => setPanels(ps => ps.filter(p => p.id !== panel.id))}
              onCodeChange={code => updatePanel(panel.id, { code })}
              onLangChange={langId => {
                const l = LANGS.find(l => l.id === langId);
                if (l) updatePanel(panel.id, { lang: l });
              }}
              onInstall={installPackage}
            />
          ))}

          {/* Add panel row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {LANGS.map(l => (
              <button
                key={l.id}
                onClick={() => setPanels(ps => [...ps, makePanel(l)])}
                className="flex items-center gap-2 p-2.5 border border-[#111] bg-[#060606] hover:border-[#222] hover:bg-[#0a0a0a] transition-all text-left group"
              >
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}80` }} />
                <span className="font-mono text-[10px] text-[#333] group-hover:text-[#666] uppercase tracking-wider">{l.name}</span>
                <Plus className="h-2.5 w-2.5 text-[#222] group-hover:text-[#444] ml-auto" />
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function PanelCard({
  panel, onRun, onSave, isSaving, onStop, onRemove, onCodeChange, onLangChange, onInstall
}: {
  panel: Panel;
  onRun: () => void;
  onSave: () => void;
  isSaving: boolean;
  onStop: () => void;
  onRemove: () => void;
  onCodeChange: (c: string) => void;
  onLangChange: (l: string) => void;
  onInstall: (lang: string, pkg: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [installPkg, setInstallPkg] = useState("");
  const { lang, status, output, execTime } = panel;

  const statusColor = status === "done" ? "#22c55e" : status === "error" ? "#ff003c" : status === "running" ? lang.color : "#333";
  const statusLabel = status === "done" ? "DONE" : status === "error" ? "ERROR" : status === "running" ? "RUNNING" : "IDLE";

  return (
    <div
      className="border overflow-hidden"
      style={{ borderColor: status === "idle" ? "#1a1a1a" : lang.border, background: lang.bg }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ borderBottom: `1px solid ${lang.border}` }}
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: lang.color,
              boxShadow: status === "running" ? `0 0 8px ${lang.color}` : `0 0 4px ${lang.color}60`,
              animation: status === "running" ? "pulse 1s ease-in-out infinite" : undefined,
            }}
          />
          <select
            value={lang.id}
            onChange={e => { e.stopPropagation(); onLangChange(e.target.value); }}
            onClick={e => e.stopPropagation()}
            className="bg-transparent font-mono text-[11px] font-bold uppercase tracking-wider border-0 focus:outline-none cursor-pointer"
            style={{ color: lang.color }}
          >
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {execTime !== null && (
            <span className="font-mono text-[10px] text-[#444]">{execTime.toFixed(2)}s</span>
          )}
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 tracking-widest"
            style={{ color: statusColor, border: `1px solid ${statusColor}30`, background: `${statusColor}08` }}
          >
            {statusLabel}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowInstall(v => !v); }}
            className="p-1 text-[#333] hover:text-[#888] transition-colors"
            title="Install package"
          >
            <Download className="h-3 w-3" />
          </button>
          {status === "running" ? (
            <button
              onClick={e => { e.stopPropagation(); onStop(); }}
              className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all"
              style={{ color: "#ff003c", border: "1px solid #ff003c40", background: "#ff003c08" }}
            >
              <Square className="h-2.5 w-2.5 fill-current" /> STOP
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onRun(); }}
              className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all"
              style={{ color: lang.color, border: `1px solid ${lang.color}40`, background: `${lang.color}08` }}
            >
              <Play className="h-2.5 w-2.5 fill-current" /> RUN
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onSave(); }}
            disabled={isSaving}
            className="flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase transition-all disabled:opacity-40"
            style={{ color: "#00ff9c", border: "1px solid #00ff9c40", background: "#00ff9c08" }}
            title="Guardar snippet en Library"
            aria-label={`Guardar código ${lang.name} en Library`}
          >
            <CloudUpload className="h-2.5 w-2.5" /> {isSaving ? "SAVING" : "SAVE"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-[#222] hover:text-[#ff003c]/60 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Install bar */}
      {showInstall && (
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: lang.border, background: "#050505" }}>
          <Download className="h-3 w-3 flex-shrink-0" style={{ color: lang.color }} />
          <input
            value={installPkg}
            onChange={e => setInstallPkg(e.target.value)}
            placeholder={lang.id === "python" ? "pip package name..." : "npm package name..."}
            className="flex-1 bg-transparent font-mono text-xs text-[#aaa] placeholder:text-[#2a2a2a] focus:outline-none"
            onKeyDown={e => {
              if (e.key === "Enter" && installPkg.trim()) {
                onInstall(lang.id, installPkg.trim());
                setInstallPkg("");
                setShowInstall(false);
              }
            }}
          />
          <button
            onClick={() => { if (installPkg.trim()) { onInstall(lang.id, installPkg.trim()); setInstallPkg(""); setShowInstall(false); } }}
            className="font-mono text-[9px] px-2 py-0.5 tracking-wider uppercase"
            style={{ color: lang.color, border: `1px solid ${lang.color}40` }}
          >
            INSTALL
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          {/* Code editor */}
          <textarea
            value={panel.code}
            onChange={e => onCodeChange(e.target.value)}
            className="w-full px-3 py-2.5 font-mono text-xs bg-transparent text-[#ccc] resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: "100px", maxHeight: "240px" }}
            spellCheck={false}
            onKeyDown={e => {
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const val = e.currentTarget.value;
                onCodeChange(val.substring(0, start) + "  " + val.substring(end));
                requestAnimationFrame(() => {
                  e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                });
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onRun();
              }
            }}
          />

          {/* Output */}
          {(status !== "idle" || output) && (
            <div className="border-t" style={{ borderColor: lang.border }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#040404" }}>
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: `${lang.color}60` }}>
                  ▶ OUTPUT
                </span>
                {status === "running" && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: lang.color }} />
                    <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: lang.color }}>
                      executing...
                    </span>
                  </div>
                )}
              </div>
              <pre
                className="px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed"
                style={{
                  maxHeight: "180px",
                  overflow: "auto",
                  color: status === "error" ? "#ff6060" : "#00ff41",
                  textShadow: status === "error" ? "0 0 4px #ff404030" : "0 0 4px #00ff4120",
                  background: "#020202",
                }}
              >
                {output || (status === "running" ? " " : "")}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
