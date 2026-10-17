import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { TerminalSquare, Wifi, WifiOff, RotateCcw, Maximize2, Minimize2, Search, X } from "lucide-react";
import { useAppContext } from "@/lib/app-context";

const BASE_HOST = window.location.host;
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${BASE_HOST}/api/terminal/ws`;

function removeTerminalControls(value: string) {
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "");
}

function writeSafeText(term: XTerm, value: string) {
  term.write(removeTerminalControls(value).replace(/\r?\n/g, "\r\n"));
}

async function typeResponse(term: XTerm, value: string, signal: AbortSignal) {
  for (const character of removeTerminalControls(value)) {
    if (signal.aborted) return;
    term.write(character === "\n" ? "\r\n" : character);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 3));
  }
}

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const deepSeekAbortRef = useRef<AbortController | null>(null);
  const { currentCode, currentLanguage } = useAppContext();
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [sessionCount, setSessionCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [smartCommand, setSmartCommand] = useState("");
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);

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
      deepSeekAbortRef.current?.abort();
      term.dispose();
      wsRef.current?.close();
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleSmartCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = smartCommand.trim();
    const term = termRef.current;
    if (!command || !term || isDeepSeekThinking) return;

    setSmartCommand("");

    if (command.toLowerCase() === "clear") {
      term.clear();
      writeSafeText(term, "[Terminal limpiada]\n");
      return;
    }

    if (command.toLowerCase() === "help") {
      writeSafeText(
        term,
        "\nComandos disponibles:\n  help              Muestra esta ayuda\n  clear             Limpia la pantalla\n  ls [opciones]     Lista archivos del proyecto en la shell local\n  ds <pregunta>     Consulta SQ-AI con streaming\n  cualquier otro    Se ejecuta en la shell local\n\n",
      );
      return;
    }

    if (command.toLowerCase() === "ds") {
      writeSafeText(term, "\nUso: ds <pregunta para SQ-AI>\n");
      return;
    }

    if (!/^ds\s+/i.test(command)) {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(`${command}\r`);
      } else {
        writeSafeText(term, "\nLa shell local está desconectada. Reconecta la sesión e inténtalo de nuevo.\n");
      }
      return;
    }

    const prompt = command.replace(/^ds\s+/i, "").trim();
    if (!prompt) {
      writeSafeText(term, "\nEscribe una pregunta después de ds.\n");
      return;
    }

    const controller = new AbortController();
    deepSeekAbortRef.current = controller;
    setIsDeepSeekThinking(true);
    writeSafeText(term, `\nSQ-AI> ${prompt}\n`);

    try {
      const context = [
        `Lenguaje del editor: ${currentLanguage}`,
        "Código abierto del editor:",
        currentCode.slice(0, 28_000),
      ].join("\n");
      const response = await fetch("/api/deepseek/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorData?.error || `Error del servidor (${response.status}).`);
      }
      if (!response.body) throw new Error("El servidor no devolvió un flujo de respuesta.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processFrame = async (frame: string) => {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") return;

        const payload = JSON.parse(data) as { delta?: string; error?: string };
        if (payload.error) throw new Error(payload.error);
        if (typeof payload.delta === "string") {
          await typeResponse(term, payload.delta, controller.signal);
        }
      };

      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          await processFrame(frame);
          if (controller.signal.aborted) break;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) await processFrame(buffer);
      if (!controller.signal.aborted) writeSafeText(term, "\n\n");
    } catch (error) {
      if (controller.signal.aborted) {
        writeSafeText(term, "\n[Consulta detenida]\n");
      } else {
        const message = error instanceof Error ? error.message : "Error de conexión.";
        writeSafeText(term, `\n[Error] ${message}\n`);
      }
    } finally {
      if (deepSeekAbortRef.current === controller) {
        deepSeekAbortRef.current = null;
      }
      setIsDeepSeekThinking(false);
    }
  };

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
              CONSOLA PTY
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
                <span className="font-mono text-[9px] text-[#00ff41]/60 tracking-widest uppercase">bash activa</span>
              </>
            ) : status === "connecting" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffd700] animate-pulse" />
                <span className="font-mono text-[9px] text-[#ffd700]/60 tracking-widest uppercase">conectando...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-[#ff003c]/60" />
                <span className="font-mono text-[9px] text-[#ff003c]/60 tracking-widest uppercase">desconectada</span>
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
                placeholder="Buscar..."
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
          { label: "lista pip", cmd: "pip list 2>/dev/null | head -20\r" },
          { label: "registro git", cmd: "git log --oneline -10 2>/dev/null || echo 'no es un repositorio git'\r" },
          { label: "ls -la", cmd: "ls -la\r" },
          { label: "ps aux", cmd: "ps aux | head -15\r" },
          { label: "free -h", cmd: "free -h\r" },
          { label: "df -h", cmd: "df -h\r" },
          { label: "curl wttr.in", cmd: "curl -s wttr.in?format=3\r" },
          { label: "actualizar pip", cmd: "pip install --upgrade pip requests httpx aiohttp numpy pandas flask fastapi 2>&1 | tail -5\r" },
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

      <form
        onSubmit={handleSmartCommand}
        className="flex items-center gap-2 border-b border-[#00ff41]/15 bg-[#050705] px-3 py-2 flex-shrink-0"
        aria-label="Terminal inteligente SQ-AI"
      >
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#00ff41] flex-shrink-0">SQ-AI $</span>
        <input
          value={smartCommand}
          onChange={(event) => setSmartCommand(event.target.value)}
          maxLength={8003}
          placeholder="help, clear, ls o ds <pregunta>"
          aria-label="Comando o pregunta para SQ-AI"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[#00ff41] placeholder:text-[#35523a] focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {isDeepSeekThinking && (
          <span className="hidden sm:inline font-mono text-[9px] tracking-widest text-[#ffd700]/70">
            RESPUESTA EN CURSO
          </span>
        )}
        {isDeepSeekThinking && (
          <button
            type="button"
            onClick={() => deepSeekAbortRef.current?.abort()}
            className="border border-[#ff003c]/30 px-2 py-1 font-mono text-[9px] tracking-widest text-[#ff5577] hover:bg-[#ff003c]/10"
          >
            DETENER
          </button>
        )}
        <button
          type="submit"
          disabled={!smartCommand.trim() || isDeepSeekThinking}
          className="border border-[#00ff41]/25 px-2 py-1 font-mono text-[9px] tracking-widest text-[#00ff41] hover:bg-[#00ff41]/10 disabled:opacity-30"
        >
          EJECUTAR
        </button>
      </form>

      {/* xterm container */}
      <div className="flex-1 overflow-hidden relative" style={{ padding: "8px 4px 4px 8px" }}>
        <div ref={containerRef} className="h-full w-full" />
        {status === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808]/80 backdrop-blur-sm">
            <div className="text-center font-mono">
              <div className="text-[#ff003c] text-sm font-bold tracking-widest uppercase mb-2">SESIÓN CERRADA</div>
              <div className="text-[#333] text-xs mb-4">Se perdió la conexión con la shell Bash</div>
              <button
                onClick={handleReconnect}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest text-black bg-[#ff003c] hover:bg-[#ff1a52]"
                style={{ boxShadow: "0 0 12px #ff003c50" }}
              >
                REINICIAR SESIÓN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
