import { Link, useLocation } from "wouter";
import { TerminalSquare, LibrarySquare, Github } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 text-card-foreground">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold text-primary transition-opacity hover:opacity-80">
            <TerminalSquare className="h-5 w-5" />
            <span>DevTerminal</span>
          </Link>
          
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link 
              href="/" 
              className={`transition-colors hover:text-primary ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Workspace
            </Link>
            <Link 
              href="/snippets" 
              className={`flex items-center gap-2 transition-colors hover:text-primary ${location === '/snippets' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <LibrarySquare className="h-4 w-4" />
              Library
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              API Connected
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-destructive"></span>
              API Offline
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
