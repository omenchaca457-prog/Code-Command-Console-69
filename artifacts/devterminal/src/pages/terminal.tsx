import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { TerminalSquare, Wifi, WifiOff, RotateCcw, Maximize2, Minimize2, Search, X } from "lucide-react";

const BASE_HOST = window.location.host;
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${BASE_HOST}/api/terminal/ws`;

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [sessionCount, setSessionCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sendResize = useCallback((term: XTerm, ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ resize: true, cols: term.cols, rows: term.rows }));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const term = termRef.current;
    if (!term || !containerRef.current) return;

    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setSessionCount(s => s + 1);
      if (fitRef.current) {
        fitRef.current.fit();
        sendResize(term, ws);
      }
    };

    ws.onmessage = (event) => {
      term.write(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
    };

    ws.onclose = () => {
      setStatus("disconnected");
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };
  }, [sendResize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      theme: {
        background: "#080808",
        foreground: "#e0e0e0",
        cursor: "#ff003c",
        cursorAccent: "#080808",
        black: "#080808",
        red: "#ff003c",
        green: "#00ff41",
        yellow: "#ffd700",
        blue: "#4d9eff",
        magenta: "#cc44ff",
        cyan: "#00ffff",
        white: "#e0e0e0",
        brightBlack: "#444444",
        brightRed: "#ff4466",
        brightGreen: "#44ff66",
        brightYellow: "#ffee44",
        brightBlue: "#66aaff",
        brightMagenta: "#dd88ff",
        brightCyan: "#44ffff",
        brightWhite: "#ffffff",
        selectionBackground: "#ff003c33",
        selectionForeground: "#ffffff",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const weblinks = new WebLinksAddon();
    const search = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(weblinks);
    term.loadAddon(search);

    fitRef.current = fit;
    searchRef.current = search;
    termRef.current = term;

    term.open(containerRef.current);
    fit.fit();

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    connect();

    const handleResize = () => {
      if (fitRef.current && termRef.current && wsRef.current) {
        fitRef.current.fit();
        sendResize(termRef.current, wsRef.current);
      }
    };

    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      term.dispose();
      wsRef.current?.close();
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleReconnect = () => {
    if (termRef.current) {
      termRef.current.clear();
      termRef.current.write("\x1b[38;5;240m[Reconnecting...]\x1b[0m\r\n");
    }
    connect();
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchRef.current && q) {
      searchRef.current.findNext(q, { decorations: { matchBackground: "#ff003c33", matchBorder: "#ff003c", matchOverviewRuler: "#ff003c", activeMatchBackground: "#ff003c66", activeMatchBorder: "#ff003c", activeMatchColorOverviewRuler: "#ff003c" } });
    }
  };

  return (
    <div className={`flex flex-col bg-[#080808] ${isFullscreen ? "fixed inset-0 z-50" : "h-full"}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 4px #ff003c)" }} />
            <span className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 8px #ff003c60" }}>
              PTY SHELL
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {status === "connected" ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff41] opacity-60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#00ff41]" style={{ boxShadow: "0 0 4px #00ff41" }} />
                </span>
                <Wifi className="h-3 w-3 text-[#00ff41]/60" />
                <span className="font-mono text-[9px] text-[#00ff41]/60 tracking-widest uppercase">live bash</span>
              </>
            ) : status === "connecting" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffd700] animate-pulse" />
                <span className="font-mono text-[9px] text-[#ffd700]/60 tracking-widest uppercase">connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-[#ff003c]/60" />
                <span className="font-mono text-[9px] text-[#ff003c]/60 tracking-widest uppercase">disconnected</span>
              </>
            )}
          </div>
          {sessionCount > 0 && (
            <span className="font-mono text-[9px] text-[#222] tracking-widest">sess:{sessionCount}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-1.5 mr-2">
              <input
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search..."
                autoFocus
                className="bg-[#040404] border border-[#ff003c]/20 px-2 py-1 font-mono text-[10px] text-[#888] placeholder:text-[#222] focus:outline-none focus:border-[#ff003c]/50 w-40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchRef.current?.findNext(searchQuery);
                  if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
                }}
              />
              <button onClick={() => searchRef.current?.findNext(searchQuery)} className="font-mono text-[9px] text-[#444] px-1.5 py-1 border border-[#1a1a1a] hover:text-[#888] hover:border-[#333]">↓</button>
              <button onClick={() => searchRef.current?.findPrevious(searchQuery)} className="font-mono text-[9px] text-[#444] px-1.5 py-1 border border-[#1a1a1a] hover:text-[#888] hover:border-[#333]">↑</button>
            </div>
          )}
          <button onClick={() => setShowSearch(v => !v)} className={`p-1.5 border transition-colors ${showSearch ? "border-[#ff003c]/30 text-[#ff003c]/60" : "border-transparent text-[#333] hover:text-[#666] hover:border-[#222]"}`}>
            <Search className="h-3 w-3" />
          </button>
          <button onClick={() => setIsFullscreen(v => !v)} className="p-1.5 border border-transparent text-[#333] hover:text-[#666] hover:border-[#222] transition-colors">
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            onClick={handleReconnect}
            disabled={status === "connecting"}
            className="p-1.5 border border-transparent text-[#333] hover:text-[#ff003c]/60 hover:border-[#ff003c]/20 transition-colors disabled:opacity-30"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          {status === "disconnected" && (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-colors ml-1"
              style={{ boxShadow: "0 0 8px #ff003c40" }}
            >
              RECONNECT
            </button>
          )}
        </div>
      </div>

      {/* Quick command bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#0f0f0f] bg-[#050505] overflow-x-auto flex-shrink-0">
        {[
          { label: "python3", cmd: "python3\r" },
          { label: "node", cmd: "node\r" },
          { label: "pip list", cmd: "pip list 2>/dev/null | head -20\r" },
          { label: "git log", cmd: "git log --oneline -10 2>/dev/null || echo 'not a git repo'\r" },
          { label: "ls -la", cmd: "ls -la\r" },
          { label: "ps aux", cmd: "ps aux | head -15\r" },
          { label: "free -h", cmd: "free -h\r" },
          { label: "df -h", cmd: "df -h\r" },
          { label: "curl wttr.in", cmd: "curl -s wttr.in?format=3\r" },
          { label: "pip upgrade", cmd: "pip install --upgrade pip requests httpx aiohttp numpy pandas flask fastapi 2>&1 | tail -5\r" },
          { label: "htop", cmd: "htop\r" },
          { label: "clear", cmd: "clear\r" },
        ].map(({ label, cmd }) => (
          <button
            key={label}
            onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(cmd);
                termRef.current?.focus();
              }
            }}
            className="font-mono text-[9px] text-[#333] border border-[#111] px-2 py-1 whitespace-nowrap hover:text-[#00ff41]/70 hover:border-[#00ff41]/20 hover:bg-[#00ff41]/5 transition-all flex-shrink-0"
          >
            {label}
          </button>
        ))}
      </div>

      {/* xterm container */}
      <div className="flex-1 overflow-hidden relative" style={{ padding: "8px 4px 4px 8px" }}>
        <div ref={containerRef} className="h-full w-full" />
        {status === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808]/80 backdrop-blur-sm">
            <div className="text-center font-mono">
              <div className="text-[#ff003c] text-sm font-bold tracking-widest uppercase mb-2">SESSION TERMINATED</div>
              <div className="text-[#333] text-xs mb-4">Connection to bash PTY lost</div>
              <button
                onClick={handleReconnect}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest text-black bg-[#ff003c] hover:bg-[#ff1a52]"
                style={{ boxShadow: "0 0 12px #ff003c50" }}
              >
                RESTART SESSION
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
