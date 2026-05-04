import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Save, Settings, ChevronRight, Check } from "lucide-react";
import Editor from "@monaco-editor/react";
import { 
  useGetLanguages, 
  useExecuteCode,
  useCreateSnippet,
  useGetRecentSnippets,
  useGetSnippet,
  getListSnippetsQueryKey,
  getGetRecentSnippetsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const snippetId = searchParams.get("snippetId");
  
  const { data: languagesData } = useGetLanguages();
  const { data: recentSnippets } = useGetRecentSnippets();
  const { data: loadedSnippet, isSuccess: snippetLoaded } = useGetSnippet(Number(snippetId), {
    query: { enabled: !!snippetId }
  });
  
  const [code, setCode] = useState<string>('console.log("Hello, DevTerminal!");');
  const [languageId, setLanguageId] = useState<string>("javascript");
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode: number; executionTime: number } | null>(null);
  
  const executeMutation = useExecuteCode();
  const createSnippetMutation = useCreateSnippet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const languages = languagesData?.languages || [];
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
  }, [snippetLoaded, loadedSnippet, languages, toast]);

  const handleRun = () => {
    setOutput(null);
    executeMutation.mutate({
      data: {
        language: languageId as any,
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

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Sidebar - Recent Snippets */}
      <div className="w-full lg:w-64 border-r border-border bg-sidebar flex flex-col hidden lg:flex">
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
                  className="w-full flex flex-col items-start gap-1 p-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-left"
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
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
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

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Editor */}
          <div className="flex-1 h-full min-h-0 bg-[#0d0d0d]">
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
          <div className="w-full lg:w-[40%] flex flex-col border-t lg:border-t-0 lg:border-l border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-sidebar/50">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terminal</span>
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
            <div className="flex-1 p-4 font-mono text-sm overflow-auto bg-black text-gray-300">
              {executeMutation.isPending ? (
                <div className="flex items-center gap-2 text-primary">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  Executing...
                </div>
              ) : output ? (
                <div className="space-y-4">
                  {output.stdout && (
                    <div className="whitespace-pre-wrap text-green-400">{output.stdout}</div>
                  )}
                  {output.stderr && (
                    <div className="whitespace-pre-wrap text-amber-500">{output.stderr}</div>
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
    </div>
  );
}
