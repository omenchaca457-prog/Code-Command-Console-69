import { useState } from "react";
import { useLocation } from "wouter";
import { useListSnippets, useDeleteSnippet, getListSnippetsQueryKey, getGetRecentSnippetsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Code2, Trash2, ExternalLink, Calendar, Terminal } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
    if (!confirm("Are you sure you want to delete this snippet?")) return;

    deleteSnippetMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentSnippetsQueryKey() });
        toast({ title: "Snippet deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    });
  };

  const openSnippet = (id: number) => {
    setLocation(`/?snippetId=${id}`);
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight text-primary">Library</h1>
          <p className="text-muted-foreground mt-2">Manage and run your saved code snippets.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 rounded-lg bg-card/50 border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border rounded-lg bg-card/30 border-dashed">
            <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No snippets found</h3>
            <p className="text-muted-foreground max-w-sm mt-1">
              {search ? "No snippets match your search criteria." : "You haven't saved any snippets yet. Go to the workspace to create one."}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setLocation("/")}>
                Go to Workspace
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredSnippets.map(snippet => (
              <div 
                key={snippet.id} 
                className="group relative flex flex-col rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => openSnippet(snippet.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{snippet.title}</h3>
                  <span className="inline-flex items-center rounded-sm bg-secondary px-2 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                    {snippet.language}
                  </span>
                </div>
                
                <div className="bg-black/50 rounded p-3 mb-4 flex-1 border border-border/50 relative overflow-hidden">
                  <pre className="font-mono text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {snippet.code}
                  </pre>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center text-xs text-muted-foreground font-mono">
                    <Calendar className="mr-1 h-3 w-3" />
                    {format(new Date(snippet.updatedAt), "MMM d, yyyy")}
                  </div>
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(snippet.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-8 gap-1"
                    >
                      <Code2 className="h-3 w-3" />
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
