import { Link, useLocation } from "wouter";
import { TerminalSquare, LibrarySquare, Cpu, ShieldAlert, Eye } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#080808] screen-flicker">
      <header className="flex h-12 items-center justify-between border-b border-[#ff003c]/20 bg-[#080808] px-4 text-foreground relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(255,0,60,0.06) 0%, transparent 50%, rgba(255,0,60,0.02) 100%)"
          }}
        />
        <div className="flex items-center gap-8 relative z-10">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.2em] uppercase relative group">
            <div className="relative">
              <Eye className="h-4 w-4 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 6px #ff003c)" }} />
            </div>
            <span
              className="glitch-text text-[#ff003c]"
              data-text="DEVTERMINAL"
              style={{ textShadow: "0 0 10px #ff003c, 0 0 20px #ff003c50" }}
            >
              DEVTERMINAL
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-xs font-mono font-semibold tracking-widest uppercase">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-all border ${
                location === '/'
                  ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                  : 'border-transparent text-[#555] hover:text-[#ff003c]/70 hover:border-[#ff003c]/20 hover:bg-[#ff003c]/5'
              }`}
            >
              <TerminalSquare className="h-3 w-3" />
              Workspace
            </Link>
            <Link
              href="/snippets"
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-all border ${
                location === '/snippets'
                  ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                  : 'border-transparent text-[#555] hover:text-[#ff003c]/70 hover:border-[#ff003c]/20 hover:bg-[#ff003c]/5'
              }`}
            >
              <LibrarySquare className="h-3 w-3" />
              Library
            </Link>
            <Link
              href="/ai"
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-all border ${
                location === '/ai'
                  ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                  : 'border-transparent text-[#555] hover:text-[#ff003c]/70 hover:border-[#ff003c]/20 hover:bg-[#ff003c]/5'
              }`}
            >
              <Cpu className="h-3 w-3" />
              AI
            </Link>
            <Link
              href="/tools"
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-all border ${
                location === '/tools'
                  ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                  : 'border-transparent text-[#555] hover:text-[#ff003c]/70 hover:border-[#ff003c]/20 hover:bg-[#ff003c]/5'
              }`}
            >
              <ShieldAlert className="h-3 w-3" />
              Tools
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 6px #00ff41" }}></span>
              </span>
              <span className="text-[#00ff41]/60">SYS:ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-[#ff003c]/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff003c]"></span>
              SYS:OFFLINE
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
