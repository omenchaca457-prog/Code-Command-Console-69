import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Save, Bot, Code, Wrench, Bug, ChevronRight } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useAppContext } from "@/lib/app-context";

export default function Home() {
  const [location] = useLocation();
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

  const executeMutation = useExecuteCode();
  const createSnippetMutation = useCreateSnippet();
  const explainMutation = useAiExplain();
  const improveMutation = useAiImprove();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const apiLanguages = languagesData?.languages || [];

  const ALL_LANGUAGES = [
    { id: "javascript", name: "JavaScript", monacoLanguage: "javascript" },
    { id: "typescript", name: "TypeScript", monacoLanguage: "typescript" },
    { id: "python", name: "Python", monacoLanguage: "python" },
    { id: "bash", name: "Bash", monacoLanguage: "shell" },
    { id: "c", name: "C", monacoLanguage: "c" },
    { id: "cpp", name: "C++", monacoLanguage: "cpp" },
    { id: "perl", name: "Perl", monacoLanguage: "perl" }
  ];

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
  }, [snippetLoaded, loadedSnippet, languages, toast, setCode, setLanguageId]);

  const handleRun = () => {
    setOutput(null);
    executeMutation.mutate({
      data: { language: languageId as any, code }
    }, {
      onSuccess: (result) => setOutput(result),
      onError: () => toast({ title: "EXECUTION FAILED", description: "Runtime error.", variant: "destructive" })
    });
  };

  const handleSaveSnippet = () => {
    if (!snippetTitle.trim()) {
      toast({ title: "ERROR", description: "Title is required.", variant: "destructive" });
      return;
    }
    createSnippetMutation.mutate({
      data: { title: snippetTitle, code, language: languageId }
    }, {
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

  const loadRecentSnippet = (code: string, langId: string) => {
    setCode(code);
    if (languages.some(l => l.id === langId)) setLanguageId(langId);
  };

  const handleExplain = () => {
    if (!code.trim()) return;
    setAiPanelTitle("// CODE ANALYSIS");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    explainMutation.mutate({ data: { code, language: languageId } }, {
      onSuccess: (res) => setAiPanelContent(res.explanation),
      onError: () => setAiPanelContent("Failed to generate analysis.")
    });
  };

  const handleImprove = () => {
    if (!code.trim()) return;
    setAiPanelTitle("// OPTIMIZATION");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    improveMutation.mutate({ data: { code, language: languageId } }, {
      onSuccess: (res) => setAiPanelContent(`${res.explanation}\n\nSuggested Code:\n\n\`\`\`${languageId}\n${res.improvedCode}\n\`\`\``),
      onError: () => setAiPanelContent("Optimization failed.")
    });
  };

  const handleFixError = () => {
    if (!code.trim() || !output?.stderr) return;
    setAiPanelTitle("// ERROR TRACE");
    setAiPanelContent("Analyzing error...");
    setIsAiPanelOpen(true);
    explainMutation.mutate({ data: { code, language: languageId, output: output.stderr } }, {
      onSuccess: (res) => setAiPanelContent(`**Error Analysis:**\n${res.explanation}`),
      onError: () => setAiPanelContent("Error analysis failed.")
    });
  };

  const renderMarkdown = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [lang, ...codeLines] = content.split('\n');
        return (
          <pre key={i} className="my-3 p-3 bg-black border border-[#00ff41]/20 text-sm font-mono text-[#00ff41] overflow-x-auto">
            <code>{codeLines.join('\n').trim()}</code>
          </pre>
        );
      }
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#ff003c]">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,255,65,0.08);color:#00ff41;padding:0 4px">$1</code>')
        .replace(/\n/g, '<br/>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className="flex h-full flex-col lg:flex-row bg-[#080808]">
      {/* Sidebar */}
      <div className="w-full lg:w-56 border-r border-[#ff003c]/15 bg-[#060606] flex-col hidden lg:flex">
        <div className="px-4 py-3 border-b border-[#ff003c]/15 flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]/60">
            // Recent
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {recentSnippets?.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-[#333]">— empty —</div>
            ) : (
              recentSnippets?.map(snippet => (
                <button
                  key={snippet.id}
                  onClick={() => loadRecentSnippet(snippet.code, snippet.language)}
                  className="w-full flex items-center gap-2 p-2 group hover:bg-[#ff003c]/5 transition-colors text-left border border-transparent hover:border-[#ff003c]/15"
                >
                  <ChevronRight className="h-3 w-3 text-[#ff003c]/30 group-hover:text-[#ff003c]/70 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-[#888] group-hover:text-[#ccc] truncate">{snippet.title}</div>
                    <div className="text-[10px] font-mono text-[#333] uppercase tracking-wider">{snippet.language}</div>
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
        <div className="flex flex-col border-b border-[#ff003c]/15 bg-[#060606]">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <Select value={languageId} onValueChange={setLanguageId}>
                <SelectTrigger className="w-[160px] h-7 bg-transparent border-[#ff003c]/25 font-mono text-xs text-[#888] uppercase tracking-wider hover:border-[#ff003c]/50 focus:ring-0 focus:border-[#ff003c]/70">
                  <SelectValue placeholder="LANG" />
                </SelectTrigger>
                <SelectContent className="bg-[#080808] border-[#ff003c]/25 font-mono text-xs">
                  {languages.map(lang => (
                    <SelectItem key={lang.id} value={lang.id} className="text-[#888] uppercase tracking-wider hover:text-[#ff003c] focus:text-[#ff003c] focus:bg-[#ff003c]/10">
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSaveDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-[#555] border border-[#333] hover:border-[#ff003c]/40 hover:text-[#ff003c]/80 hover:bg-[#ff003c]/5 transition-all"
              >
                <Save className="h-3 w-3" />
                SAVE
              </button>
              <button
                onClick={handleRun}
                disabled={executeMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all disabled:opacity-50"
                style={{ boxShadow: "0 0 12px #ff003c60, 0 0 24px #ff003c20" }}
              >
                {executeMutation.isPending ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-black border-t-transparent" />
                ) : (
                  <Play className="h-3 w-3 fill-current" />
                )}
                {executeMutation.isPending ? "EXEC..." : "EXECUTE"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-[#ff003c]/08">
            <span className="text-[10px] font-mono text-[#333] mr-1 flex items-center gap-1 tracking-widest uppercase">
              <Bot className="h-3 w-3 text-[#ff003c]/40" /> AI:
            </span>
            <button
              onClick={handleExplain}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-[#ff003c]/50 hover:text-[#ff003c] hover:bg-[#ff003c]/10 border border-transparent hover:border-[#ff003c]/20 transition-all tracking-wider uppercase"
            >
              <Code className="h-2.5 w-2.5" /> Explain
            </button>
            <button
              onClick={handleImprove}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-[#ff003c]/50 hover:text-[#ff003c] hover:bg-[#ff003c]/10 border border-transparent hover:border-[#ff003c]/20 transition-all tracking-wider uppercase"
            >
              <Wrench className="h-2.5 w-2.5" /> Optimize
            </button>
            {output?.exitCode !== 0 && output?.exitCode !== undefined && (
              <button
                onClick={handleFixError}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-[#ff4040]/60 hover:text-[#ff4040] hover:bg-[#ff4040]/10 border border-transparent hover:border-[#ff4040]/30 transition-all tracking-wider uppercase"
              >
                <Bug className="h-2.5 w-2.5" /> Fix Error
              </button>
            )}
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
                fontFamily: "var(--app-font-mono)",
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

          {/* Terminal */}
          <div className="w-full lg:w-[38%] flex flex-col border-t lg:border-t-0 lg:border-l border-[#ff003c]/15 bg-[#060606]">
            <div className="flex items-center justify-between border-b border-[#ff003c]/15 px-4 py-2 bg-[#040404]">
              <span className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase flex items-center gap-2">
                <span className="text-[#00ff41]/70" style={{ textShadow: "0 0 6px #00ff4160" }}>
                  ▶ TERMINAL
                </span>
                {output?.exitCode !== 0 && output?.exitCode !== undefined && (
                  <span className="bg-[#ff003c]/15 text-[#ff003c]/80 px-1.5 py-0.5 text-[9px] tracking-wider border border-[#ff003c]/20">
                    AI POWERED
                  </span>
                )}
              </span>
              {output && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#444]">{output.executionTime}ms</span>
                  <span className={`font-mono text-[10px] px-2 py-0.5 border ${output.exitCode === 0 ? 'border-[#00ff41]/30 text-[#00ff41]/80 bg-[#00ff41]/5' : 'border-[#ff003c]/30 text-[#ff4040] bg-[#ff003c]/5'}`}>
                    EXIT:{output.exitCode}
                  </span>
                  <button
                    onClick={() => setOutput(null)}
                    className="font-mono text-[10px] text-[#333] hover:text-[#ff003c]/70 transition-colors tracking-wider uppercase"
                  >
                    [CLEAR]
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-xs overflow-auto bg-[#040404] text-[#666]">
              {executeMutation.isPending ? (
                <div className="flex items-center gap-2 text-[#ff003c]/70">
                  <div className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-pulse" style={{ boxShadow: "0 0 6px #ff003c" }} />
                  <span className="tracking-widest uppercase text-[10px]">Executing...</span>
                </div>
              ) : output ? (
                <div className="space-y-3">
                  {output.stdout && (
                    <div className="whitespace-pre-wrap text-[#00ff41] leading-relaxed" style={{ textShadow: "0 0 4px #00ff4130" }}>
                      {output.stdout}
                    </div>
                  )}
                  {output.stderr && (
                    <div className="whitespace-pre-wrap text-[#ff4040] leading-relaxed" style={{ textShadow: "0 0 4px #ff404030" }}>
                      {output.stderr}
                    </div>
                  )}
                  {!output.stdout && !output.stderr && (
                    <div className="text-[#333] italic text-[10px] tracking-wider uppercase">— no output —</div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] tracking-widest uppercase terminal-cursor text-[#222]">Ready</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#080808] border border-[#ff003c]/30 shadow-[0_0_40px_#ff003c20]">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff003c]">// SAVE SNIPPET</DialogTitle>
            <DialogDescription className="font-mono text-[10px] text-[#444] tracking-wider">
              Commit this code to persistent memory.
            </DialogDescription>
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
            <button
              onClick={() => setIsSaveDialogOpen(false)}
              className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#555] border border-[#333] hover:border-[#555] hover:text-[#888] transition-all"
            >
              ABORT
            </button>
            <button
              onClick={handleSaveSnippet}
              disabled={createSnippetMutation.isPending}
              className="px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all disabled:opacity-50"
              style={{ boxShadow: "0 0 12px #ff003c50" }}
            >
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
            <SheetDescription className="font-mono text-[10px] text-[#333] tracking-wider uppercase">
              Neural analysis in progress
            </SheetDescription>
          </SheetHeader>
          <div className="text-xs text-[#888] font-mono leading-relaxed">
            {(explainMutation.isPending || improveMutation.isPending) ? (
              <div className="flex items-center gap-2 mt-4 text-[#ff003c]/70">
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce"></span>
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                <span className="ml-2 tracking-widest uppercase text-[10px]">Processing...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {renderMarkdown(aiPanelContent)}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
