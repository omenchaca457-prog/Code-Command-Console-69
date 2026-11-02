import "./_group.css";
import {
  Activity,
  BrainCircuit,
  Bot,
  Code2,
  Cpu,
  Eye,
  LibrarySquare,
  Network,
  Play,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  TrendingUp,
} from "lucide-react";

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

export function CurrentNavigation() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080808] text-[#eaeaea]">
      <header className="relative flex h-11 w-full items-center justify-between border-b border-[#ff003c]/20 bg-[#060606] px-3">
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(255,0,60,0.05),transparent_60%)]" />
        <div className="relative z-10 flex min-w-0 items-center gap-3 overflow-x-auto">
          <a href="/" className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold tracking-[0.2em]">
            <Eye className="h-3.5 w-3.5 text-[#ff003c]" />
            <span className="hidden lg:block text-[#ff003c]">DEVTERMINAL</span>
          </a>
          <nav className="flex shrink-0 items-center gap-0 font-mono text-[10px] font-semibold uppercase tracking-wider">
            {navItems.map(({ href, label, icon: Icon, color }, index) => (
              <a
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap border px-2 py-1.5"
                style={index === 0
                  ? { borderColor: `${color}40`, color, background: `${color}10` }
                  : { borderColor: "transparent", color: "#333" }}
                aria-label={label}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:block">{label}</span>
              </a>
            ))}
          </nav>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-[#00ff41]/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00ff41]" />
          <span className="hidden sm:block">ONLINE</span>
        </div>
      </header>
      <main className="p-5 font-mono text-xs text-[#555]">
        <span className="text-[#ff003c]/60">▸ TERMINAL</span>
        <p className="mt-3 text-[#00ff41]/50">The current app content remains below this header.</p>
      </main>
    </div>
  );
}
