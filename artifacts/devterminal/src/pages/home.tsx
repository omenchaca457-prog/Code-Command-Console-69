import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Play, Save, Bot, Code, Wrench, Bug, ChevronRight, Zap, CheckCircle, XCircle, Package, RefreshCw, Cpu, AlertTriangle } from "lucide-react";
import Editor from "@monaco-editor/react";
import {
  useGetLanguages,
  useExecuteCode,
  useCreateSnippet,
  useGetRecentSnippets,
  useGetSnippet,
  getListSnippetsQueryKey,
  getGetRecentSnippetsQueryKey,
  useAiExplain,
  useAiImprove
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useAppContext } from "@/lib/app-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type AutoStep =
  | { type: "scan"; msg: string }
  | { type: "analysis"; issues: string[]; packages: string[]; hasChanges: boolean; explanation: string }
  | { type: "fix"; msg: string; fixedCode: string }
  | { type: "install"; msg: string; package: string }
  | { type: "installed"; msg: string; package: string }
  | { type: "install_error"; msg: string }
  | { type: "run"; msg: string; attempt: number }
  | { type: "output"; stdout: string; stderr: string; exitCode: number; executionTime: number }
  | { type: "retry"; msg: string; attempt: number; fixedCode: string }
  | { type: "done"; msg: string; exitCode: number; totalTime: number }
  | { type: "error"; msg: string };

const STEP_ICONS: Record<string, React.ReactNode> = {
  scan: <Cpu className="h-3 w-3 text-[#00ffff] animate-spin" />,
  analysis: <AlertTriangle className="h-3 w-3 text-[#ffd700]" />,
  fix: <Wrench className="h-3 w-3 text-[#a78bfa]" />,
  install: <Package className="h-3 w-3 text-[#f59e0b] animate-pulse" />,
  installed: <CheckCircle className="h-3 w-3 text-[#00ff41]" />,
  install_error: <XCircle className="h-3 w-3 text-[#ff003c]" />,
  run: <Play className="h-3 w-3 text-[#00ffff] animate-pulse" />,
  output: <Code className="h-3 w-3 text-[#00ff41]" />,
  retry: <RefreshCw className="h-3 w-3 text-[#f59e0b] animate-spin" />,
  done: <CheckCircle className="h-3 w-3 text-[#00ff41]" />,
  error: <XCircle className="h-3 w-3 text-[#ff003c]" />,
};

export default function Home() {
  const searchParams = new URLSearchParams(window.location.search);
  const snippetId = searchParams.get("snippetId");

  const { currentCode: code, setCurrentCode: setCode, currentLanguage: languageId, setCurrentLanguage: setLanguageId } = useAppContext();

  const { data: languagesData } = useGetLanguages();
  const { data: recentSnippets } = useGetRecentSnippets();
  const { data: loadedSnippet, isSuccess: snippetLoaded } = useGetSnippet(Number(snippetId), {
    query: { enabled: !!snippetId }
  });

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode: number; executionTime: number } | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelTitle, setAiPanelTitle] = useState("");
  const [aiPanelContent, setAiPanelContent] = useState("");

  // Autonomous mode state
  const [autoSteps, setAutoSteps] = useState<AutoStep[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoDone, setAutoDone] = useState<{ exitCode: number; totalTime: number } | null>(null);
  const [showAutoPanel, setShowAutoPanel] = useState(false);
  const autoScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const executeMutation = useExecuteCode();
  const createSnippetMutation = useCreateSnippet();
  const explainMutation = useAiExplain();
  const improveMutation = useAiImprove();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ALL_LANGUAGES = [
    { id: "javascript", name: "JavaScript", monacoLanguage: "javascript" },
    { id: "typescript", name: "TypeScript", monacoLanguage: "typescript" },
    { id: "python", name: "Python", monacoLanguage: "python" },
    { id: "bash", name: "Bash", monacoLanguage: "shell" },
    { id: "c", name: "C", monacoLanguage: "c" },
    { id: "cpp", name: "C++", monacoLanguage: "cpp" },
    { id: "go", name: "Go", monacoLanguage: "go" },
    { id: "rust", name: "Rust", monacoLanguage: "rust" },
    { id: "perl", name: "Perl", monacoLanguage: "perl" }
  ];

  const apiLanguages = languagesData?.languages || [];
  const languages = ALL_LANGUAGES.map(lang => {
    const apiLang = apiLanguages.find(l => l.id === lang.id);
    return apiLang || lang;
  });

  const currentLang = languages.find(l => l.id === languageId);
  const monacoLanguage = currentLang?.monacoLanguage || "javascript";

  useEffect(() => {
    if (snippetLoaded && loadedSnippet) {
      setCode(loadedSnippet.code);
      if (languages.some(l => l.id === loadedSnippet.language)) {
        setLanguageId(loadedSnippet.language);
      }
      toast({ title: "// SNIPPET LOADED", description: loadedSnippet.title });
    }
  }, [snippetLoaded, loadedSnippet]);

  useEffect(() => {
    autoScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [autoSteps]);

  // AUTONOMOUS EXECUTE — streams SSE from /api/ai/auto-run
  const handleAutoRun = useCallback(async () => {
    if (!code.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setAutoSteps([]);
    setAutoDone(null);
    setAutoRunning(true);
    setShowAutoPanel(true);
    setOutput(null);

    try {
      const resp = await fetch(`${BASE_URL}/api/ai/auto-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: languageId }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        setAutoSteps(s => [...s, { type: "error", msg: `HTTP ${resp.status}` }]);
        setAutoRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            const step = event.step as string;

            setAutoSteps(s => [...s, { type: step, ...event } as AutoStep]);

            // Apply fixed code to editor automatically
            if ((step === "fix" || step === "retry") && event.fixedCode) {
              setCode(event.fixedCode);
            }

            // Capture final output
            if (step === "output") {
              setOutput({
                stdout: event.stdout,
                stderr: event.stderr,
                exitCode: event.exitCode,
                executionTime: event.executionTime,
              });
            }

            if (step === "done") {
              setAutoDone({ exitCode: event.exitCode, totalTime: event.totalTime });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setAutoSteps(s => [...s, { type: "error", msg: String(err) }]);
      }
    } finally {
      setAutoRunning(false);
    }
  }, [code, languageId, setCode]);

  const handleRun = () => {
    setOutput(null);
    setShowAutoPanel(false);
    executeMutation.mutate({
      data: { language: languageId as any, code }
    }, {
      onSuccess: (result) => setOutput(result),
      onError: () => toast({ title: "EXECUTION FAILED", variant: "destructive" })
    });
  };

  const handleSaveSnippet = () => {
    if (!snippetTitle.trim()) {
      toast({ title: "ERROR", description: "Title is required.", variant: "destructive" });
      return;
    }
    createSnippetMutation.mutate({ data: { title: snippetTitle, code, language: languageId } }, {
      onSuccess: () => {
        setIsSaveDialogOpen(false);
        setSnippetTitle("");
        queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
        toast({ title: "// SAVED", description: "Snippet committed to memory." });
      },
      onError: () => toast({ title: "ERROR", description: "Save failed.", variant: "destructive" })
    });
  };

  const handleExplain = () => {
    if (!code.trim()) return;
    setAiPanelTitle("// CODE ANALYSIS");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    explainMutation.mutate({ data: { code, language: languageId } }, {
      onSuccess: (res) => setAiPanelContent(res.explanation || ""),
      onError: () => setAiPanelContent("Failed to generate analysis.")
    });
  };

  const handleImprove = () => {
    if (!code.trim()) return;
    setAiPanelTitle("// OPTIMIZATION");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    improveMutation.mutate({ data: { code, language: languageId } }, {
      onSuccess: (res) => {
        setAiPanelContent(res.explanation || "");
        if (res.improvedCode) setCode(res.improvedCode);
      },
      onError: () => setAiPanelContent("Optimization failed.")
    });
  };

  const renderMarkdown = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [, ...codeLines] = content.split('\n');
        return (
          <pre key={i} className="my-3 p-3 bg-black border border-[#00ff41]/20 text-sm font-mono text-[#00ff41] overflow-x-auto">
            <code>{codeLines.join('\n').trim()}</code>
          </pre>
        );
      }
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#ff003c]">$1</strong>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,255,65,0.08);color:#00ff41;padding:0 4px">$1</code>')
        .replace(/\n/g, '<br/>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  const lastOutput = autoSteps.filter(s => s.type === "output").slice(-1)[0] as Extract<AutoStep, { type: "output" }> | undefined;
  const analysisStep = autoSteps.find(s => s.type === "analysis") as Extract<AutoStep, { type: "analysis" }> | undefined;
  const hasAutoError = autoDone && autoDone.exitCode !== 0;

  return (
    <div className="flex h-full flex-col lg:flex-row bg-[#080808]">
      {/* Sidebar */}
      <div className="w-full lg:w-52 border-r border-[#ff003c]/12 bg-[#060606] flex-col hidden lg:flex flex-shrink-0">
        <div className="px-3 py-2.5 border-b border-[#ff003c]/12">
          <span className="text-[9px] font-mono font-bold tracking-[0.3em] uppercase text-[#ff003c]/50">// Recent</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {!recentSnippets?.length ? (
              <div className="p-4 text-center text-[10px] font-mono text-[#222]">— empty —</div>
            ) : (
              recentSnippets.map(snippet => (
                <button
                  key={snippet.id}
                  onClick={() => { setCode(snippet.code); if (languages.some(l => l.id === snippet.language)) setLanguageId(snippet.language); }}
                  className="w-full flex items-center gap-2 p-2 hover:bg-[#ff003c]/5 border border-transparent hover:border-[#ff003c]/15 transition-all text-left"
                >
                  <ChevronRight className="h-3 w-3 text-[#ff003c]/25 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[#777] truncate">{snippet.title}</div>
                    <div className="text-[9px] font-mono text-[#2a2a2a] uppercase tracking-wider">{snippet.language}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Toolbar */}
        <div className="flex flex-col border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2">
            <Select value={languageId} onValueChange={setLanguageId}>
              <SelectTrigger className="w-[140px] h-7 bg-transparent border-[#ff003c]/20 font-mono text-[10px] text-[#777] uppercase tracking-wider hover:border-[#ff003c]/40 focus:ring-0">
                <SelectValue placeholder="LANG" />
              </SelectTrigger>
              <SelectContent className="bg-[#080808] border-[#ff003c]/25 font-mono text-[10px]">
                {languages.map(lang => (
                  <SelectItem key={lang.id} value={lang.id} className="text-[#777] uppercase tracking-wider focus:text-[#ff003c] focus:bg-[#ff003c]/10">
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSaveDialogOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono tracking-widest uppercase text-[#444] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 transition-all"
              >
                <Save className="h-3 w-3" /> SAVE
              </button>

              {/* Regular execute */}
              <button
                onClick={handleRun}
                disabled={executeMutation.isPending || autoRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase text-[#888] border border-[#333] hover:border-[#00ff41]/40 hover:text-[#00ff41] hover:bg-[#00ff41]/5 transition-all disabled:opacity-40"
              >
                {executeMutation.isPending ? <div className="h-3 w-3 animate-spin rounded-full border border-[#00ff41] border-t-transparent" /> : <Play className="h-3 w-3" />}
                RUN
              </button>

              {/* AUTONOMOUS execute — the star */}
              <button
                onClick={autoRunning ? () => { abortRef.current?.abort(); setAutoRunning(false); } : handleAutoRun}
                disabled={executeMutation.isPending}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase transition-all disabled:opacity-40 ${
                  autoRunning
                    ? 'text-[#ff003c] border border-[#ff003c]/50 bg-[#ff003c]/10 animate-pulse'
                    : 'text-black bg-[#ff003c] hover:bg-[#ff1a52]'
                }`}
                style={!autoRunning ? { boxShadow: "0 0 14px #ff003c60, 0 0 28px #ff003c20" } : undefined}
              >
                {autoRunning
                  ? <><div className="h-3 w-3 animate-spin rounded-full border border-[#ff003c] border-t-transparent" /> STOP</>
                  : <><Zap className="h-3 w-3 fill-current" /> AUTO</>
                }
              </button>
            </div>
          </div>

          {/* AI tools bar */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-[#ff003c]/08">
            <Bot className="h-3 w-3 text-[#ff003c]/30 flex-shrink-0" />
            <span className="text-[9px] font-mono text-[#2a2a2a] mr-1 tracking-widest uppercase">AI:</span>
            {[
              { label: "Explain", icon: Code, fn: handleExplain },
              { label: "Optimize", icon: Wrench, fn: handleImprove },
            ].map(({ label, icon: Icon, fn }) => (
              <button key={label} onClick={fn}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-[#ff003c]/40 hover:text-[#ff003c] hover:bg-[#ff003c]/8 border border-transparent hover:border-[#ff003c]/15 transition-all tracking-wider uppercase">
                <Icon className="h-2.5 w-2.5" /> {label}
              </button>
            ))}
            {output?.exitCode !== 0 && output?.exitCode !== undefined && (
              <button onClick={handleAutoRun}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-[#ff4040]/60 hover:text-[#ff4040] hover:bg-[#ff4040]/8 border border-transparent hover:border-[#ff4040]/20 transition-all tracking-wider uppercase animate-pulse">
                <Bug className="h-2.5 w-2.5" /> Auto-Fix
              </button>
            )}
            <div className="ml-auto text-[9px] font-mono text-[#1a1a1a] tracking-widest">
              {autoRunning ? (
                <span className="text-[#00ffff]/40 animate-pulse">● NEURAL ACTIVE</span>
              ) : autoDone ? (
                <span className={autoDone.exitCode === 0 ? "text-[#00ff41]/40" : "text-[#ff003c]/40"}>
                  {autoDone.exitCode === 0 ? "✓ AUTO SUCCESS" : "✗ AUTO FAILED"}
                </span>
              ) : (
                <span>PRESS AUTO TO RUN AUTONOMOUS</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Editor */}
          <div className="flex-1 h-full min-h-0 bg-[#070707]">
            <Editor
              height="100%"
              language={monacoLanguage}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "phase",
                renderLineHighlight: "gutter",
                lineNumbersMinChars: 3,
                glyphMargin: false,
              }}
            />
          </div>

          {/* Output / Auto Panel */}
          <div className="w-full lg:w-[40%] flex flex-col border-t lg:border-t-0 lg:border-l border-[#ff003c]/12 bg-[#050505] min-h-0">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-[#ff003c]/12 px-3 py-2 bg-[#040404] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase">
                  {showAutoPanel
                    ? <span className="text-[#00ffff]" style={{ textShadow: "0 0 6px #00ffff50" }}>⚡ AUTO-RUN</span>
                    : <span className="text-[#00ff41]/70">▶ OUTPUT</span>
                  }
                </span>
                {showAutoPanel && analysisStep && (
                  <span className="text-[9px] font-mono text-[#333]">
                    {analysisStep.issues.length > 0 ? `${analysisStep.issues.length} issues fixed` : "code clean"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {showAutoPanel && autoDone && (
                  <span className={`font-mono text-[9px] px-2 py-0.5 border ${autoDone.exitCode === 0 ? 'border-[#00ff41]/30 text-[#00ff41]/80 bg-[#00ff41]/5' : 'border-[#ff003c]/30 text-[#ff003c]/80 bg-[#ff003c]/5'}`}>
                    {autoDone.exitCode === 0 ? 'SUCCESS' : 'FAILED'} · {(autoDone.totalTime / 1000).toFixed(1)}s
                  </span>
                )}
                {!showAutoPanel && output && (
                  <>
                    <span className="font-mono text-[10px] text-[#333]">{output.executionTime}ms</span>
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${output.exitCode === 0 ? 'border-[#00ff41]/25 text-[#00ff41]/70' : 'border-[#ff003c]/25 text-[#ff003c]/70'}`}>
                      EXIT:{output.exitCode}
                    </span>
                  </>
                )}
                <button onClick={() => { setOutput(null); setAutoSteps([]); setAutoDone(null); setShowAutoPanel(false); }}
                  className="font-mono text-[9px] text-[#222] hover:text-[#555] tracking-wider uppercase transition-colors">
                  [CLR]
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* AUTONOMOUS MODE panel */}
              {showAutoPanel ? (
                <div className="p-3 space-y-1.5 font-mono text-[11px]">
                  {autoSteps.map((step, i) => (
                    <AutoStepRow key={i} step={step} />
                  ))}
                  {autoRunning && (
                    <div className="flex items-center gap-2 text-[#00ffff]/50 pt-1">
                      <div className="h-1.5 w-1.5 bg-[#00ffff] rounded-full animate-bounce" />
                      <div className="h-1.5 w-1.5 bg-[#00ffff] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <div className="h-1.5 w-1.5 bg-[#00ffff] rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  )}
                  <div ref={autoScrollRef} />

                  {/* Final output inside auto panel */}
                  {lastOutput && (
                    <div className="mt-3 border-t border-[#ff003c]/10 pt-3 space-y-2">
                      {lastOutput.stdout && (
                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-[#00ff41]"
                          style={{ textShadow: "0 0 4px #00ff4120" }}>
                          {lastOutput.stdout}
                        </div>
                      )}
                      {lastOutput.stderr && lastOutput.exitCode !== 0 && (
                        <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-[#ff4040]">
                          {lastOutput.stderr}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* REGULAR OUTPUT */
                <div className="p-3 font-mono text-[11px]">
                  {executeMutation.isPending ? (
                    <div className="flex items-center gap-2 text-[#ff003c]/60 mt-2">
                      <div className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-pulse" />
                      <span className="tracking-widest uppercase text-[10px]">Executing...</span>
                    </div>
                  ) : output ? (
                    <div className="space-y-2">
                      {output.stdout && (
                        <div className="whitespace-pre-wrap text-[#00ff41] leading-relaxed" style={{ textShadow: "0 0 3px #00ff4120" }}>
                          {output.stdout}
                        </div>
                      )}
                      {output.stderr && (
                        <div className="whitespace-pre-wrap text-[#ff4040] leading-relaxed">
                          {output.stderr}
                        </div>
                      )}
                      {!output.stdout && !output.stderr && (
                        <div className="text-[#2a2a2a] text-[10px] tracking-wider uppercase">— no output —</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-[#111] text-[10px] tracking-widest uppercase mb-2">ready</div>
                      <div className="text-[#0d0d0d] text-[9px] tracking-widest">press AUTO for autonomous execution</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#080808] border border-[#ff003c]/30 shadow-[0_0_40px_#ff003c15]">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff003c]">// SAVE SNIPPET</DialogTitle>
            <DialogDescription className="font-mono text-[10px] text-[#333] tracking-wider">Commit this code to persistent memory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="snippet_name"
              value={snippetTitle}
              onChange={(e) => setSnippetTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSnippet()}
              autoFocus
              className="bg-[#040404] border-[#ff003c]/25 font-mono text-xs text-[#ccc] placeholder:text-[#333] focus-visible:border-[#ff003c]/60 focus-visible:ring-0"
            />
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setIsSaveDialogOpen(false)} className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#555] border border-[#333] hover:border-[#555] hover:text-[#888] transition-all">ABORT</button>
            <button onClick={handleSaveSnippet} disabled={createSnippetMutation.isPending}
              className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#ff003c] hover:bg-[#ff1a52] disabled:opacity-50" style={{ boxShadow: "0 0 12px #ff003c40" }}>
              {createSnippetMutation.isPending ? "WRITING..." : "COMMIT"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Panel */}
      <Sheet open={isAiPanelOpen} onOpenChange={setIsAiPanelOpen}>
        <SheetContent className="w-[420px] sm:w-[520px] overflow-y-auto bg-[#070707] border-l border-[#ff003c]/25">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase text-[#ff003c]">
              <Bot className="h-4 w-4" /> {aiPanelTitle}
            </SheetTitle>
            <SheetDescription className="font-mono text-[10px] text-[#333] tracking-wider uppercase">Neural analysis</SheetDescription>
          </SheetHeader>
          <div className="text-xs text-[#888] font-mono leading-relaxed">
            {(explainMutation.isPending || improveMutation.isPending) ? (
              <div className="flex items-center gap-2 mt-4 text-[#ff003c]/60">
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" />
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                <span className="ml-2 tracking-widest uppercase text-[10px]">Processing...</span>
              </div>
            ) : (
              <div className="space-y-3">{renderMarkdown(aiPanelContent)}</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AutoStepRow({ step }: { step: AutoStep }) {
  const icon = STEP_ICONS[step.type];

  if (step.type === "analysis") {
    return (
      <div className="space-y-1">
        {step.issues.length > 0 && (
          <div className="border border-[#ffd700]/15 bg-[#ffd700]/3 p-2 space-y-1">
            <div className="text-[9px] uppercase tracking-widest text-[#ffd700]/60 mb-1">⚠ Issues detectados:</div>
            {step.issues.map((iss, i) => (
              <div key={i} className="text-[10px] text-[#888] leading-relaxed pl-2">• {iss}</div>
            ))}
          </div>
        )}
        {step.packages.length > 0 && (
          <div className="flex items-center gap-1.5 text-[#f59e0b]/70 text-[10px]">
            <Package className="h-3 w-3" />
            <span>Librerías faltantes: <span className="text-[#f59e0b]">{step.packages.join(", ")}</span></span>
          </div>
        )}
        {step.issues.length === 0 && step.packages.length === 0 && (
          <div className="flex items-center gap-1.5 text-[#00ff41]/60 text-[10px]">
            <CheckCircle className="h-3 w-3" /> Código limpio — sin errores detectados
          </div>
        )}
        {step.explanation && step.hasChanges && (
          <div className="text-[9px] text-[#444] italic pl-1">{step.explanation}</div>
        )}
      </div>
    );
  }

  if (step.type === "output") {
    return null; // shown separately below
  }

  const colors: Record<string, string> = {
    scan: "#00ffff", fix: "#a78bfa", install: "#f59e0b", installed: "#00ff41",
    install_error: "#ff003c", run: "#00ffff", retry: "#f59e0b",
    done: step.type === "done" && step.exitCode === 0 ? "#00ff41" : "#ff003c",
    error: "#ff003c",
  };

  const color = colors[step.type] || "#555";
  const msg = "msg" in step ? step.msg : "";

  return (
    <div className="flex items-start gap-2" style={{ color }}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-[11px] leading-relaxed">{msg}</span>
    </div>
  );
}
