import { useState, useEffect, useRef } from "react";
import { useAiChat, useAiExplain, useAiImprove } from "@workspace/api-client-react";
import { useAppContext } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Send, Code, Wrench, Bug, Copy, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NeuralNet } from "@/components/neural-net";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AI() {
  const { currentCode, currentLanguage } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "SYSTEM ONLINE. I am your DevTerminal neural interface. Feed me code — I will analyze, optimize, or debug it. Ask me anything." }
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const chatMutation = useAiChat();
  const explainMutation = useAiExplain();
  const improveMutation = useAiImprove();

  const isThinking = chatMutation.isPending || explainMutation.isPending || improveMutation.isPending;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    chatMutation.mutate({
      data: { message: userMsg, context: currentCode, language: currentLanguage }
    }, {
      onSuccess: (res) => setMessages(prev => [...prev, {
        role: "assistant",
        content: typeof res.response === "string" && res.response.trim()
          ? res.response
          : "The AI returned no response."
      }]),
      onError: () => toast({ title: "CONNECTION FAILED", description: "Neural link disrupted.", variant: "destructive" })
    });
  };

  const handleExplain = () => {
    if (!currentCode.trim()) {
      toast({ title: "NO CODE", description: "Workspace is empty." });
      return;
    }
    setMessages(prev => [...prev, { role: "user", content: `Analyze the current ${currentLanguage} code.` }]);
    explainMutation.mutate({ data: { code: currentCode, language: currentLanguage } }, {
      onSuccess: (res) => setMessages(prev => [...prev, {
        role: "assistant",
        content: typeof res.result === "string" && res.result.trim()
          ? res.result
          : "The AI returned no explanation."
      }]),
      onError: () => toast({ title: "ERROR", description: "Analysis failed.", variant: "destructive" })
    });
  };

  const handleImprove = () => {
    if (!currentCode.trim()) {
      toast({ title: "NO CODE", description: "Workspace is empty." });
      return;
    }
    setMessages(prev => [...prev, { role: "user", content: `Optimize the current ${currentLanguage} code.` }]);
    improveMutation.mutate({ data: { code: currentCode, language: currentLanguage } }, {
      onSuccess: (res) => {
        const improvedCode = typeof res.result === "string" ? res.result.trim() : "";
        setMessages(prev => [...prev, {
          role: "assistant",
          content: improvedCode
            ? `Optimized code:\n\n\`\`\`${currentLanguage}\n${improvedCode}\n\`\`\``
            : "The AI returned no optimized code."
        }]);
      },
      onError: () => toast({ title: "ERROR", description: "Optimization failed.", variant: "destructive" })
    });
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
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ff003c">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:#aaa">$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,255,65,0.06);color:#00ff41;padding:1px 4px;font-size:11px">$1</code>')
        .replace(/\n/g, '<br/>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
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
              NEURAL INTERFACE
            </h1>
            <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">AI-POWERED CODE INTELLIGENCE</p>
          </div>
        </div>

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
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Code className="h-2.5 w-2.5" /> Analyze Code
            </button>
            <button
              onClick={handleImprove}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 hover:bg-[#ff003c]/5 transition-all disabled:opacity-30"
            >
              <Wrench className="h-2.5 w-2.5" /> Optimize
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
              placeholder="// Enter query..."
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
              disabled={!input.trim() || isThinking}
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
