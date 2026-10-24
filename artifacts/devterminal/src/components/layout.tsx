import { Link, useLocation } from "wouter";
import { TerminalSquare, LibrarySquare, Cpu, ShieldAlert, Eye, Play, Network, Bot, Code2, BrainCircuit, Sparkles, Activity, TrendingUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const activeLocation = location === "/" ? "/" : location.replace(/\/+$/, "");
  const { data: health } = useHealthCheck();
  const defaultTitle = useRef(document.title);
  useEffect(() => {
    document.title = activeLocation === "/trading" ? "MÁQUINA 4105 // TRADING" : defaultTitle.current;
  }, [activeLocation]);

  const navItems = [
    { href: "/", label: "Terminal", icon: TerminalSquare, color: "#ff003c" },
    { href: "/editor", label: "Editor", icon: Code2, color: "#ff003c" },
    { href: "/runner", label: "Runner", icon: Play, color: "#ff003c" },
    { href: "/snippets", label: "Library", icon: LibrarySquare, color: "#ff003c" },
    { href: "/ai", label: "AI", icon: Cpu, color: "#ff003c" },
    { href: "/tools", label: "Tools", icon: ShieldAlert, color: "#ff003c" },
    { href: "/neural", label: "Neural", icon: Network, color: "#00ffff" },
    { href: "/agents", label: "Agents", icon: Bot, color: "#a78bfa" },
    { href: "/cortex", label: "Cortex IA", icon: BrainCircuit, color: "#00ff41" },
    { href: "/creator", label: "CREATOR", icon: Sparkles, color: "#ff4de1" },
    { href: "/motor", label: "MOTOR 5.5", icon: Activity, color: "#00f0ff" },
    { href: "/trading", label: "TRADING", icon: TrendingUp, color: "#00f0ff" },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#080808] screen-flicker">
      <header className="flex h-11 items-center justify-between border-b border-[#ff003c]/20 bg-[#060606] px-3 text-foreground relative flex-shrink-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(90deg, rgba(255,0,60,0.05) 0%, transparent 60%)" }}
        />
        <div className="flex items-center gap-3 relative z-10 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <Link href="/" className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.2em] uppercase flex-shrink-0">
            <Eye className="h-3.5 w-3.5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 5px #ff003c)" }} />
            <span
              className="glitch-text text-[#ff003c] hidden lg:block"
              data-text="DEVTERMINAL"
              style={{ textShadow: "0 0 8px #ff003c, 0 0 16px #ff003c40" }}
            >
              DEVTERMINAL
            </span>
          </Link>

          <div className="w-px h-4 bg-[#ff003c]/15 hidden sm:block flex-shrink-0" />

          <nav className="flex items-center gap-0 text-[10px] font-mono font-semibold tracking-wider uppercase">
            {navItems.map(({ href, label, icon: Icon, color }) => {
              const isActive = activeLocation === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1 px-2 py-1.5 transition-all border whitespace-nowrap flex-shrink-0"
                  style={isActive ? {
                    borderColor: color + "40",
                    color,
                    background: color + "10",
                  } : {
                    borderColor: "transparent",
                    color: "#333",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = color + "80";
                      (e.currentTarget as HTMLElement).style.background = color + "08";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "#333";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 5px #00ff41" }} />
              </span>
              <span className="text-[#00ff41]/50 hidden sm:block">ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase text-[#ff003c]/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff003c]" />
              <span className="hidden sm:block">OFFLINE</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
