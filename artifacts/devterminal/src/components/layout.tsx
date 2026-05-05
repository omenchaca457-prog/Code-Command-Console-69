import { Link, useLocation } from "wouter";
import { TerminalSquare, LibrarySquare, Cpu, ShieldAlert, Eye, Play, Network, Bot } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "Terminal", icon: TerminalSquare },
    { href: "/runner", label: "Runner", icon: Play },
    { href: "/snippets", label: "Library", icon: LibrarySquare },
    { href: "/ai", label: "AI", icon: Cpu },
    { href: "/tools", label: "Tools", icon: ShieldAlert },
    { href: "/neural", label: "Neural", icon: Network },
    { href: "/agents", label: "Agents", icon: Bot },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#080808] screen-flicker">
      <header className="flex h-12 items-center justify-between border-b border-[#ff003c]/20 bg-[#080808] px-3 text-foreground relative flex-shrink-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, rgba(255,0,60,0.06) 0%, transparent 50%, rgba(255,0,60,0.02) 100%)"
          }}
        />
        <div className="flex items-center gap-4 relative z-10 min-w-0 overflow-x-auto scrollbar-hide">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.2em] uppercase flex-shrink-0">
            <Eye className="h-4 w-4 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 6px #ff003c)" }} />
            <span
              className="glitch-text text-[#ff003c] hidden lg:block"
              data-text="DEVTERMINAL"
              style={{ textShadow: "0 0 10px #ff003c, 0 0 20px #ff003c50" }}
            >
              DEVTERMINAL
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isNeural = href === "/neural";
              const isAgents = href === "/agents";
              const activeColor = isNeural ? "#00ffff" : isAgents ? "#a78bfa" : "#ff003c";
              const isActive = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-2 py-1.5 transition-all border whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? `border-[${activeColor}]/50 bg-[${activeColor}]/10`
                      : 'border-transparent text-[#444] hover:bg-[#111]'
                  }`}
                  style={isActive ? {
                    borderColor: activeColor + "50",
                    color: activeColor,
                    background: activeColor + "12"
                  } : undefined}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" style={isActive ? { color: activeColor } : undefined} />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4 relative z-10 flex-shrink-0">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 6px #00ff41" }}></span>
              </span>
              <span className="text-[#00ff41]/60 hidden md:block">ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase text-[#ff003c]/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff003c]"></span>
              <span className="hidden md:block">OFFLINE</span>
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
