import { InlineMarkdown } from "@/components/inline-markdown";
import { Link } from "wouter";
import { useWorkspaceStatus } from "@/lib/workspace-status";
import { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import { Send, Code, Wrench, Bug, Copy, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NeuralNet } from "@/components/neural-net";
import { useToast } from "@/hooks/use-toast";
import { consumeDeepseekSse } from "@/lib/deepseek-stream";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AI() {
  const { currentCode, currentLanguage } = useAppContext();
  const { events, recordEvent } = useNeuralContext();
  const { data: workspace } = useWorkspaceStatus();
  const deepseekConfigured = workspace?.integrations.some(item => item.id === "deepseek" && item.configured) ?? false;
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "[STATUS] Núcleo SQ-AI listo. Contexto del editor y diagnósticos del sistema disponibles.\n[DATA] Ω pendiente de evidencia. ECR-Code: 410542503.\n[READY] Formula una consulta técnica, Arquitecto." }
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [isDeepseekThinking, setIsDeepseekThinking] = useState(false);
  const isThinking = isDeepseekThinking;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const sendDeepseekPrompt = async (userMsg: string, context: string) => {
    if (!userMsg.trim() || isDeepseekThinking || !deepseekConfigured) return;
    setMessages(prev => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setIsDeepseekThinking(true);
    recordEvent({ origin: "terminal", eventType: "ai_query", content: "Consulta enviada desde la interfaz SQ-AI" });
    try {
      const response = await fetch("/api/deepseek/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg, context }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || `Error del servidor (${response.status}).`);
      }
      if (!response.body) throw new Error("El servidor no devolvió un flujo SSE.");
      await consumeDeepseekSse(response.body, new AbortController().signal, (text) => {
        setMessages(previous => {
        const next = [...previous];
        const last = next.at(-1);
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + text };
        return next;
      });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de conexión.";
      setMessages(previous => {
        const next = [...previous];
        const last = next.at(-1);
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: last.content ? `${last.content}\n[ALERT] ${message}` : `[ALERT] ${message}`,
          };
        }
        return next;
      });
      toast({ title: "FALLO DE ENLACE SQ-AI", description: message, variant: "destructive" });
    } finally {
      setIsDeepseekThinking(false);
    }
  };

  const codeContext = () => JSON.stringify({
    page: "ai",
    editor: {
      language: currentLanguage,
      status: currentCode.trim() ? "loaded" : "empty",
      codeCharacters: currentCode.length,
      code: currentCode.slice(0, 20_000),
    },
    recentRunnerAndAgentActivity: events
      .filter(item => item.origin === "runner" || item.origin === "agents")
      .slice(0, 8)
      .map(({ origin, eventType, content, createdAt }) => ({ origin, eventType, content, createdAt })),
    library: "Consulta get_library_snapshot.",
    serverAndWebviewLogs: "Consulta get_runtime_diagnostics.",
    integrations: "Consulta get_integrations_status sin solicitar credenciales.",
  });

  const handleSend = () => {
    const userMsg = input.trim();
    if (!userMsg || !deepseekConfigured) return;
    setInput("");
    void sendDeepseekPrompt(userMsg, codeContext());
  };

  const handleExplain = () => {
    if (!currentCode.trim()) {
      toast({ title: "Falta código", description: "Abre o escribe código en el editor primero." });
      return;
    }
    const prompt = `Explica el siguiente código ${currentLanguage} de forma clara, señalando propósito, flujo y riesgos. No edites archivos, no escribas cambios y no ejecutes código.`;
    void sendDeepseekPrompt(prompt, codeContext());
  };

  const handleImprove = () => {
    if (!currentCode.trim()) {
      toast({ title: "Falta código", description: "Abre o escribe código en el editor primero." });
      return;
    }
    const prompt = `Propón una versión mejorada del código ${currentLanguage} del contexto y explica brevemente los cambios. Devuelve el código en un bloque cercado. No edites archivos, no apliques cambios y no ejecutes código.`;
    void sendDeepseekPrompt(prompt, codeContext());
  };

  const renderMarkdown = (value: unknown) => {
    const text = typeof value === "string" ? value : "Response unavailable.";
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [lang, ...code] = content.split('\n');
        return (
          <div key={i} className="my-3 border border-[#00ff41]/20 overflow-hidden bg-black">
            <div className="flex justify-between items-center px-3 py-1.5 bg-[#0a0a0a] border-b border-[#00ff41]/15">
              <span className="text-[10px] font-mono text-[#00ff41]/50 uppercase tracking-wider">{lang || 'code'}</span>
              <button
                className="text-[10px] font-mono text-[#333] hover:text-[#00ff41]/70 tracking-wider uppercase transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(code.join('\n').trim());
                  toast({ title: "COPIED" });
                }}
              >
                [copy]
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-[#00ff41] overflow-x-auto leading-relaxed" style={{ textShadow: "0 0 4px #00ff4120" }}>
              <code>{code.join('\n').trim()}</code>
            </pre>
          </div>
        );
      }
      return <InlineMarkdown key={i} text={part} />;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#070707] relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* Neural net in corner */}
      <div className="absolute top-4 right-4 z-10 opacity-60">
        <NeuralNet isThinking={isThinking} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl w-full mx-auto p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <Eye className="h-5 w-5 text-[#ff003c]" style={{ filter: "drop-shadow(0 0 8px #ff003c)" }} />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 12px #ff003c60" }}>
              ASISTENTE DE DESARROLLO
            </h1>
            <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">DEEPSEEK · CONTEXTO DE TU WORKSPACE</p>
          </div>
        </div>

        {!deepseekConfigured && <div className="ai-connection-notice" role="status"><span>{workspace ? "Configura DeepSeek para empezar a conversar." : "Comprobando la conexión con el servidor…"}</span><Link href="/settings">Ver conexiones →</Link></div>}

        {/* Messages */}
        <ScrollArea className="flex-1 pr-2 mb-4">
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-7 w-7 flex items-center justify-center border text-[10px] font-mono font-bold ${
                  msg.role === 'user'
                    ? 'border-[#ff003c]/50 text-[#ff003c] bg-[#ff003c]/10'
                    : 'border-[#00ff41]/30 text-[#00ff41] bg-[#00ff41]/5'
                }`}>
                  {msg.role === 'user' ? 'YOU' : 'AI'}
                </div>
                <div className={`max-w-[85%] p-3 text-xs font-mono leading-relaxed border ${
                  msg.role === 'user'
                    ? 'border-[#ff003c]/20 bg-[#ff003c]/5 text-[#ccc]'
                    : 'border-[#00ff41]/15 bg-[#00ff41]/3 text-[#999]'
                }`}>
                  <div>{renderMarkdown(msg.content)}</div>
                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-[#ffffff]/5 flex justify-end">
                      <button
                        className="text-[9px] font-mono text-[#333] hover:text-[#00ff41]/60 tracking-widest uppercase transition-colors flex items-center gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast({ title: "COPIED" });
                        }}
                      >
                        <Copy className="h-2.5 w-2.5" /> [COPY]
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center border border-[#00ff41]/30 text-[#00ff41] bg-[#00ff41]/5 text-[10px] font-mono font-bold">
                  AI
                </div>
                <div className="border border-[#00ff41]/15 bg-[#00ff41]/3 p-3 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c" }}></span>
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c", animationDelay: '0.2s' }}></span>
                  <span className="h-1.5 w-1.5 bg-[#ff003c] rounded-full animate-bounce" style={{ boxShadow: "0 0 4px #ff003c", animationDelay: '0.4s' }}></span>
                  <span className="ml-2 text-[10px] font-mono text-[#ff003c]/50 tracking-widest uppercase">THINKING</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border border-[#ff003c]/20 bg-[#060606]">
          <div className="flex gap-2 px-3 py-2 border-b border-[#ff003c]/10">
            <button
              onClick={handleExplain}
              disabled={isThinking || !deepseekConfigured}
              title={deepseekConfigured ? "Analizar el código con DeepSeek" : "Configura DEEPSEEK_API_KEY en Replit Secrets"}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Code className="h-2.5 w-2.5" /> Explicar
            </button>
            <button
              onClick={handleImprove}
              disabled={isThinking || !deepseekConfigured}
              title={deepseekConfigured ? "Proponer mejoras con DeepSeek" : "Configura DEEPSEEK_API_KEY en Replit Secrets"}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Wrench className="h-2.5 w-2.5" /> Mejorar
            </button>
            <button
              onClick={() => setInput("Fix error: ")}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff4040]/30 hover:text-[#ff4040]/70 hover:bg-[#ff4040]/5 transition-all disabled:opacity-30"
            >
              <Bug className="h-2.5 w-2.5" /> Fix Error
            </button>
          </div>
          <div className="flex gap-0">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={deepseekConfigured ? "Pregunta sobre tu código…" : "Configura DeepSeek en Conexiones para conversar"}
              aria-label="Pregunta para el asistente DeepSeek"
              disabled={!deepseekConfigured}
              className="flex-1 min-h-[56px] max-h-[140px] resize-none bg-transparent border-0 px-3 py-2.5 font-mono text-xs text-[#aaa] placeholder:text-[#2a2a2a] focus:outline-none focus:ring-0"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking || !deepseekConfigured}
              aria-label="Enviar pregunta"
              className="px-4 self-stretch text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              style={{ boxShadow: input.trim() ? "0 0 12px #ff003c40" : "none" }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
