import { useState, useEffect, useRef } from "react";
import { useAiChat, useAiExplain, useAiImprove } from "@workspace/api-client-react";
import { useAppContext } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, Code, Wrench, Bug, Copy } from "lucide-react";
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
    { role: "assistant", content: "I am your DevTerminal AI assistant. I can explain code, suggest improvements, fix errors, or answer any programming questions." }
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
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: "assistant", content: res.response }]);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to connect to AI.", variant: "destructive" });
      }
    });
  };

  const handleExplain = () => {
    if (!currentCode.trim()) {
      toast({ title: "No code to explain", description: "The workspace is empty." });
      return;
    }
    
    setMessages(prev => [...prev, { role: "user", content: `Explain the current ${currentLanguage} code.` }]);
    
    explainMutation.mutate({
      data: { code: currentCode, language: currentLanguage }
    }, {
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: "assistant", content: res.explanation }]);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to get explanation.", variant: "destructive" });
      }
    });
  };

  const handleImprove = () => {
    if (!currentCode.trim()) {
      toast({ title: "No code to improve", description: "The workspace is empty." });
      return;
    }
    
    setMessages(prev => [...prev, { role: "user", content: `How can I improve the current ${currentLanguage} code?` }]);
    
    improveMutation.mutate({
      data: { code: currentCode, language: currentLanguage }
    }, {
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: "assistant", content: res.explanation + "\n\n```" + currentLanguage + "\n" + res.improvedCode + "\n```" }]);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to get improvements.", variant: "destructive" });
      }
    });
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering for bold, italic, code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.substring(3, part.length - 3);
        const [lang, ...code] = content.split('\n');
        return (
          <div key={i} className="my-3 rounded-md bg-black border border-border overflow-hidden">
            <div className="flex justify-between items-center px-3 py-1 bg-sidebar text-xs text-muted-foreground font-mono">
              <span>{lang || 'code'}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => {
                  navigator.clipboard.writeText(code.join('\n').trim());
                  toast({ title: "Copied to clipboard" });
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <pre className="p-3 text-sm font-mono text-green-400 overflow-x-auto">
              <code>{code.join('\n').trim()}</code>
            </pre>
          </div>
        );
      }
      
      // Basic formatting for non-code text
      let html = part
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-black/50 text-cyan-400 px-1 py-0.5 rounded">$1</code>')
        .replace(/\n/g, '<br/>');
        
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] relative">
      <div className="absolute top-4 right-4 z-10">
        <NeuralNet isThinking={isThinking} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
              <Bot className="h-6 w-6" /> AI Assistant
            </h1>
            <p className="text-muted-foreground text-sm">Powered by DevTerminal</p>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4 mb-4">
          <div className="flex flex-col gap-6 pb-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div 
                  className={`max-w-[85%] rounded-lg p-4 ${
                    msg.role === 'user' 
                      ? 'bg-card border border-primary/30 text-card-foreground' 
                      : 'bg-[#161b22] border border-border text-foreground'
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    {renderMarkdown(msg.content)}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="mt-3 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-muted-foreground gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          toast({ title: "Response copied" });
                        }}
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-[#161b22] border border-border rounded-lg p-4 flex items-center gap-1">
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        <div className="mt-auto bg-card border border-border rounded-xl p-3 shadow-lg">
          <div className="flex gap-2 mb-3">
            <Button variant="secondary" size="sm" className="gap-2 text-xs" onClick={handleExplain} disabled={isThinking}>
              <Code className="h-3 w-3" /> Explain Code
            </Button>
            <Button variant="secondary" size="sm" className="gap-2 text-xs" onClick={handleImprove} disabled={isThinking}>
              <Wrench className="h-3 w-3" /> Improve Code
            </Button>
            <Button variant="secondary" size="sm" className="gap-2 text-xs" onClick={() => setInput("Fix error: ")} disabled={isThinking}>
              <Bug className="h-3 w-3" /> Fix Error
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about programming..."
              className="min-h-[60px] max-h-[200px] resize-y bg-background border-border focus-visible:ring-primary font-mono text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button 
              size="icon" 
              className="h-auto w-12 flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}