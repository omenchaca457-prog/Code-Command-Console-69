import { useEffect, useRef, useState, type FormEvent } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { TerminalSquare, Maximize2, Minimize2, Search, X, Trash2, AlertTriangle } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import {
  consumeDeepseekSse,
  persistDeepseekAssistantResponse,
} from "@/lib/deepseek-stream";
import { writeNewAutonomousEvents } from "@/lib/terminal-autonomous-events";

const TERMINAL_CONVERSATION_ID = "terminal_main_session";

type TerminalHistoryMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

async function persistTerminalMessage(role: "user" | "assistant", content: string) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: TERMINAL_CONVERSATION_ID, role, content }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || "No se pudo guardar el historial de la terminal.");
  }
}

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
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const deepSeekAbortRef = useRef<AbortController | null>(null);
  const lastAutonomousEventIdRef = useRef(0);
  const initializedAutonomousEventsRef = useRef(false);
  const { currentCode, currentLanguage } = useAppContext();
  const { recordEvent, events } = useNeuralContext();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [smartCommand, setSmartCommand] = useState("");
  const [isDeepSeekThinking, setIsDeepSeekThinking] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  useEffect(() => {
    if (!initializedAutonomousEventsRef.current) {
      lastAutonomousEventIdRef.current = events.reduce(
        (largest, event) => Math.max(largest, event.id),
        0,
      );
      initializedAutonomousEventsRef.current = true;
      return;
    }

    lastAutonomousEventIdRef.current = writeNewAutonomousEvents(
      events,
      lastAutonomousEventIdRef.current,
      (content) => {
        if (termRef.current) writeSafeText(termRef.current, content);
      },
    );
  }, [events]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/messages?conversation_id=${TERMINAL_CONVERSATION_ID}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo recuperar el historial.");
        return await response.json() as TerminalHistoryMessage[];
      })
      .then((messages) => {
        const term = termRef.current;
        if (!term || controller.signal.aborted || messages.length === 0) return;
        writeSafeText(term, "\n[Historial de terminal recuperado]\n");
        for (const message of messages) {
          const speaker = message.role === "user" ? "Arquitecto" : "SQ-AI";
          writeSafeText(term, `${speaker}> ${message.content}\n\n`);
        }
        writeSafeText(term, "[Fin del historial]\n\n");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && termRef.current) {
          const message = error instanceof Error ? error.message : "Error de conexión.";
          writeSafeText(termRef.current, `\n[Historial] ${message}\n`);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      disableStdin: true,
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
    writeSafeText(
      term,
      "[PTY deshabilitada por seguridad. No se ejecutan comandos en el servidor.]\n[Usa ds <pregunta> para consultar SQ-AI.]\n\n",
    );

    const handleResize = () => {
      fitRef.current?.fit();
    };

    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      deepSeekAbortRef.current?.abort();
      term.dispose();
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
        "\nComandos disponibles:\n  help              Muestra esta ayuda\n  clear             Limpia la pantalla\n  ds <pregunta>     Consulta SQ-AI con streaming\n\nLa ejecución de comandos de shell está deshabilitada por seguridad.\n\n",
      );
      return;
    }

    if (command.toLowerCase() === "ds") {
      writeSafeText(term, "\nUso: ds <pregunta para SQ-AI>\n");
      return;
    }

    if (!/^ds\s+/i.test(command)) {
      writeSafeText(term, "\n[PTY deshabilitada] Los comandos de shell no se ejecutan.\n");
      return;
    }

    const prompt = command.replace(/^ds\s+/i, "").trim();
    if (!prompt) {
      writeSafeText(term, "\nEscribe una pregunta después de ds.\n");
      return;
    }

    const controller = new AbortController();
    let assistantResponse = "";
    let userMessageSaved = false;
    recordEvent({
      origin: "terminal",
      eventType: "ai_query",
      content: "Consulta SQ-AI enviada desde la terminal",
    });
    deepSeekAbortRef.current = controller;
    setIsDeepSeekThinking(true);
    writeSafeText(term, `\nSQ-AI> ${prompt}\n`);

    try {
      await persistTerminalMessage("user", prompt);
      userMessageSaved = true;
      const context = [
        JSON.stringify({
          page: "terminal",
          editor: {
            language: currentLanguage,
            status: currentCode.trim() ? "loaded" : "empty",
            codeCharacters: currentCode.length,
            code: currentCode.slice(0, 20_000),
          },
          recentRunnerAndAgentActivity: events
            .filter((item) => item.origin === "runner" || item.origin === "agents")
            .slice(0, 8)
            .map(({ origin, eventType, content, createdAt }) => ({ origin, eventType, content, createdAt })),
          serverAndWebviewLogs: "Consulta get_runtime_diagnostics para logs recientes.",
          library: "Consulta get_library_snapshot para snippets guardados.",
          integrations: "Consulta get_integrations_status; nunca envíes valores secretos.",
        }),
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

      const result = await consumeDeepseekSse(
        response.body,
        controller.signal,
        (delta) => {
          assistantResponse += delta;
          return typeResponse(term, delta, controller.signal);
        },
      );
      assistantResponse = result.text;
      if (result.stopped) {
        writeSafeText(term, "\n[Consulta detenida]\n");
        if (userMessageSaved) {
          await persistDeepseekAssistantResponse(
            assistantResponse,
            true,
            (content) => persistTerminalMessage("assistant", content),
          );
        }
        return;
      }
      await persistDeepseekAssistantResponse(
        assistantResponse,
        false,
        (content) => persistTerminalMessage("assistant", content),
      );
      writeSafeText(term, "\n\n");
    } catch (error) {
      if (controller.signal.aborted) {
        writeSafeText(term, "\n[Consulta detenida]\n");
      } else {
        const message = error instanceof Error ? error.message : "Error de conexión.";
        writeSafeText(term, `\n[Error] ${message}\n`);
      }
      if (userMessageSaved) {
        await persistDeepseekAssistantResponse(
          assistantResponse,
          true,
          (content) => persistTerminalMessage("assistant", content),
        ).catch(() => undefined);
      }
    } finally {
      if (deepSeekAbortRef.current === controller) {
        deepSeekAbortRef.current = null;
      }
      setIsDeepSeekThinking(false);
    }
  };

  const handleClearChat = async () => {
    if (isClearingChat || isDeepSeekThinking) return;
    setIsClearingChat(true);
    try {
      const response = await fetch(
        `/api/messages?conversation_id=${TERMINAL_CONVERSATION_ID}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || "No se pudo limpiar el historial.");
      }
      termRef.current?.clear();
      if (termRef.current) writeSafeText(termRef.current, "[Historial de chat limpiado]\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión.";
      if (termRef.current) writeSafeText(termRef.current, `\n[Error] ${message}\n`);
    } finally {
      setIsClearingChat(false);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-3 py-2 border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 4px #ff003c)" }} />
            <span className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 8px #ff003c60" }}>
              CONSOLA PTY
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-[#ff003c]" aria-hidden="true" />
            <span className="font-mono text-[9px] text-[#ff9aac] tracking-widest uppercase">PTY deshabilitada</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {showSearch && (
            <div className="mr-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <input
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar..."
                autoFocus
                className="min-h-11 min-w-0 w-24 border border-[#ff003c]/20 bg-[#040404] px-2 font-mono text-[10px] text-[#888] placeholder:text-[#222] focus:outline-none focus:border-[#ff003c]/50 sm:w-40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchRef.current?.findNext(searchQuery);
                  if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
                }}
              />
              <button type="button" aria-label="Buscar coincidencia siguiente" onClick={() => searchRef.current?.findNext(searchQuery)} className="min-h-11 min-w-11 border border-[#1a1a1a] px-1.5 font-mono text-[9px] text-[#444] hover:border-[#333] hover:text-[#888]">↓</button>
              <button type="button" aria-label="Buscar coincidencia anterior" onClick={() => searchRef.current?.findPrevious(searchQuery)} className="min-h-11 min-w-11 border border-[#1a1a1a] px-1.5 font-mono text-[9px] text-[#444] hover:border-[#333] hover:text-[#888]">↑</button>
            </div>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            disabled={isClearingChat || isDeepSeekThinking}
            className="flex min-h-11 items-center gap-1 border border-[#ff003c]/20 px-2 font-mono text-[9px] tracking-widest text-[#ff6680] hover:bg-[#ff003c]/10 disabled:opacity-40"
            aria-label="Limpiar Chat"
          >
            <Trash2 className="h-3 w-3" />
            <span>{isClearingChat ? "LIMPIANDO…" : "LIMPIAR CHAT"}</span>
          </button>
          <button type="button" aria-label="Buscar en el historial" aria-expanded={showSearch} onClick={() => setShowSearch(v => !v)} className={`flex min-h-11 min-w-11 items-center justify-center border transition-colors ${showSearch ? "border-[#ff003c]/30 text-[#ff003c]/60" : "border-transparent text-[#333] hover:text-[#666] hover:border-[#222]"}`}>
            <Search className="h-3 w-3" />
          </button>
          <button type="button" aria-label={isFullscreen ? "Salir de pantalla completa" : "Abrir pantalla completa"} onClick={() => setIsFullscreen(v => !v)} className="flex min-h-11 min-w-11 items-center justify-center border border-transparent text-[#333] transition-colors hover:border-[#222] hover:text-[#666]">
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div role="status" className="flex items-start gap-2 border-b border-[#ff003c]/20 bg-[#ff003c]/5 px-3 py-2 font-mono text-[10px] leading-relaxed text-[#ff9aac]">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff003c]" aria-hidden="true" />
        <span>La terminal interactiva está desactivada porque esta app no tiene autenticación ni aislamiento de procesos verificado. SQ-AI y el historial siguen disponibles.</span>
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
          maxLength={4000}
          placeholder="help, clear o ds <pregunta>"
          aria-label="Comando o pregunta para SQ-AI"
          className="min-h-11 min-w-0 flex-1 bg-transparent font-mono text-xs text-[#00ff41] placeholder:text-[#35523a] focus:outline-none"
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
          className="min-h-11 border border-[#00ff41]/25 px-3 font-mono text-[10px] tracking-widest text-[#00ff41] hover:bg-[#00ff41]/10 disabled:opacity-30"
        >
          CONSULTAR
        </button>
      </form>

      {/* xterm container */}
      <div className="flex-1 overflow-hidden relative" style={{ padding: "8px 4px 4px 8px" }}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
