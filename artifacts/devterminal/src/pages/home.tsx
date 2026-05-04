import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Save, Bot, Code, Wrench, Bug } from "lucide-react";
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
  
  // AI States
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelTitle, setAiPanelTitle] = useState("");
  const [aiPanelContent, setAiPanelContent] = useState("");

  const executeMutation = useExecuteCode();
  const createSnippetMutation = useCreateSnippet();
  const explainMutation = useAiExplain();
  const improveMutation = useAiImprove();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The backend supports javascript, typescript, python, bash, c, cpp, perl
  const apiLanguages = languagesData?.languages || [];
  
  // Ensure we have our full list if API doesn't return all
  const ALL_LANGUAGES = [
    { id: "javascript", name: "JavaScript", monacoLanguage: "javascript" },
    { id: "typescript", name: "TypeScript", monacoLanguage: "typescript" },
    { id: "python", name: "Python", monacoLanguage: "python" },
    { id: "bash", name: "Bash", monacoLanguage: "shell" },
    { id: "c", name: "C", monacoLanguage: "c" },
    { id: "cpp", name: "C++", monacoLanguage: "cpp" },
    { id: "perl", name: "Perl", monacoLanguage: "perl" }
  ];

  // Merge lists
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
      toast({
        title: "Snippet loaded",
        description: `Loaded "${loadedSnippet.title}"`,
      });
    }
  }, [snippetLoaded, loadedSnippet, languages, toast, setCode, setLanguageId]);

  const handleRun = () => {
    setOutput(null);
    executeMutation.mutate({
      data: {
        language: languageId as any, // the backend supports it even if types are behind
        code
      }
    }, {
      onSuccess: (result) => {
        setOutput(result);
      },
      onError: () => {
        toast({
          title: "Execution failed",
          description: "Failed to run code.",
          variant: "destructive"
        });
      }
    });
  };

  const handleSaveSnippet = () => {
    if (!snippetTitle.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    
    createSnippetMutation.mutate({
      data: {
        title: snippetTitle,
        code,
        language: languageId
      }
    }, {
      onSuccess: () => {
        setIsSaveDialogOpen(false);
        setSnippetTitle("");
        queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
        toast({ title: "Success", description: "Snippet saved." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save snippet.", variant: "destructive" });
      }
    });
  };

  const loadRecentSnippet = (code: string, langId: string) => {
    setCode(code);
    if (languages.some(l => l.id === langId)) {
      setLanguageId(langId);
    }
  };

  const handleExplain = () => {
    if (!code.trim()) return;
    setAiPanelTitle("Code Explanation");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    
    explainMutation.mutate({
      data: { code, language: languageId }
    }, {
      onSuccess: (res) => {
        setAiPanelContent(res.explanation);
      },
      onError: () => {
        setAiPanelContent("Failed to generate explanation. Please try again.");
      }
    });
  };

  const handleImprove = () => {
    if (!code.trim()) return;
    setAiPanelTitle("Code Improvement");
    setAiPanelContent("Analyzing...");
    setIsAiPanelOpen(true);
    
    improveMutation.mutate({
      data: { code, language: languageId }
    }, {
      onSuccess: (res) => {
        setAiPanelContent(`${res.explanation}\n\nSuggested Code:\n\n\`\`\`${languageId}\n${res.improvedCode}\n\`\`\``);
        // Optionally prompt to replace code, for now we just show it.
      },
      onError: () => {
        setAiPanelContent("Failed to generate improvements. Please try again.");
      }
    });
  };

  const handleFixError = () => {
    if (!code.trim() || !output?.stderr) return;
    setAiPanelTitle("Fix Error");
    setAiPanelContent("Analyzing error...");
    setIsAiPanelOpen(true);
    
    explainMutation.mutate({
      data: { code, language: languageId, output: output.stderr }
    }, {
      onSuccess: (res) => {
        setAiPanelContent(`**Error Analysis:**\n${res.explanation}`);
      },
      onError: () => {
        setAiPanelContent("Failed to analyze error. Please try again.");
      }
    });
  };

  const renderMarkdown = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [lang, ...codeLines] = content.split('\n');
        return (
          <pre key={i} className="my-3 p-3 bg-black border border-border rounded text-sm font-mono text-green-400 overflow-x-auto">
            <code>{codeLines.join('\n').trim()}</code>
          </pre>
        );
      }
      
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-black/50 text-cyan-400 px-1 py-0.5 rounded">$1</code>')
        .replace(/\n/g, '<br/>');
        
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className="flex h-full flex-col lg:flex-row bg-[#0d1117]">
      {/* Sidebar - Recent Snippets */}
      <div className="w-full lg:w-64 border-r border-border bg-[#161b22] flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-border">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/70">Recent</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {recentSnippets?.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No recent snippets</div>
            ) : (
              recentSnippets?.map(snippet => (
                <button
                  key={snippet.id}
                  onClick={() => loadRecentSnippet(snippet.code, snippet.language)}
                  className="w-full flex flex-col items-start gap-1 p-2 rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <span className="font-medium text-sm truncate w-full">{snippet.title}</span>
                  <span className="text-xs text-muted-foreground font-mono">{snippet.language}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex flex-col border-b border-border bg-[#161b22]">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-4">
              <Select value={languageId} onValueChange={setLanguageId}>
                <SelectTrigger className="w-[180px] h-8 bg-background border-border font-mono text-sm">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(lang => (
                    <SelectItem key={lang.id} value={lang.id} className="font-mono text-sm">
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2"
                onClick={() => setIsSaveDialogOpen(true)}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button 
                size="sm" 
                className="h-8 gap-2 font-bold"
                onClick={handleRun}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run Code
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border/50 bg-[#0d1117]/50">
            <span className="text-xs font-mono text-muted-foreground mr-2 flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI Tools:
            </span>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-primary hover:bg-primary/20 hover:text-primary gap-1" onClick={handleExplain}>
              <Code className="h-3 w-3" /> Explain
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-primary hover:bg-primary/20 hover:text-primary gap-1" onClick={handleImprove}>
              <Wrench className="h-3 w-3" /> Improve
            </Button>
            {output?.exitCode !== 0 && output?.exitCode !== undefined && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:bg-destructive/20 hover:text-destructive gap-1" onClick={handleFixError}>
                <Bug className="h-3 w-3" /> Fix Error
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Editor */}
          <div className="flex-1 h-full min-h-0 bg-[#0d1117]">
            <Editor
              height="100%"
              language={monacoLanguage}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "var(--app-font-mono)",
                lineHeight: 24,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                renderLineHighlight: "all",
              }}
            />
          </div>
          
          {/* Terminal Output */}
          <div className="w-full lg:w-[40%] flex flex-col border-t lg:border-t-0 lg:border-l border-border bg-[#161b22]">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-[#0d1117]">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Terminal
                {output?.exitCode !== 0 && output?.exitCode !== undefined && (
                  <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                    <Bot className="h-3 w-3" /> AI Powered
                  </span>
                )}
              </span>
              {output && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{output.executionTime}ms</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-sm ${output.exitCode === 0 ? 'bg-green-500/20 text-green-400' : 'bg-destructive/20 text-destructive-foreground'}`}>
                    Exit {output.exitCode}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setOutput(null)}>Clear</Button>
                </div>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-sm overflow-auto bg-[#0d1117] text-gray-300 shadow-inner">
              {executeMutation.isPending ? (
                <div className="flex items-center gap-2 text-primary">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  Executing...
                </div>
              ) : output ? (
                <div className="space-y-4">
                  {output.stdout && (
                    <div className="whitespace-pre-wrap text-[#39ff14]">{output.stdout}</div>
                  )}
                  {output.stderr && (
                    <div className="whitespace-pre-wrap text-[#ff4444]">{output.stderr}</div>
                  )}
                  {!output.stdout && !output.stderr && (
                    <div className="text-muted-foreground italic">No output</div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground/50 italic">Ready.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Snippet</DialogTitle>
            <DialogDescription>
              Save this code to your library for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <Input
                id="title"
                placeholder="e.g. Binary Search Tree"
                value={snippetTitle}
                onChange={(e) => setSnippetTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSnippet()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSnippet} disabled={createSnippetMutation.isPending}>
              {createSnippetMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isAiPanelOpen} onOpenChange={setIsAiPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-[#161b22] border-l border-border">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 text-primary">
              <Bot className="h-5 w-5" /> {aiPanelTitle}
            </SheetTitle>
            <SheetDescription>
              AI analysis of your current code.
            </SheetDescription>
          </SheetHeader>
          <div className="text-sm text-foreground leading-relaxed">
            {(explainMutation.isPending || improveMutation.isPending) ? (
              <div className="flex items-center gap-2 mt-4 text-primary">
                <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                <span className="ml-2">Analyzing...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {renderMarkdown(aiPanelContent)}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}