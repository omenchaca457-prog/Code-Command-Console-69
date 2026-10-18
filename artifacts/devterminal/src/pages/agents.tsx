import { useState, useRef, useCallback, useEffect } from "react";
import { Zap, Plus, Square, RefreshCw, Send, ChevronRight, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";
import { AgentRunLock } from "@/lib/agent-run-lock";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type AgentRole = {
  id: string;
  name: string;
  icon: string;
  color: string;
  systemPrompt: string;
};

const ROLES: AgentRole[] = [
  {
    id: "optimizer",
    name: "Optimizer",
    icon: "⚡",
    color: "#f59e0b",
    systemPrompt: "Eres un agente de optimización de código. Analiza el código dado y sugiere mejoras de rendimiento y eficiencia. Sé conciso y técnico. Responde en español o inglés según el contexto."
  },
  {
    id: "security",
    name: "Security",
    icon: "🔴",
    color: "#ff003c",
    systemPrompt: "Eres un agente de análisis de seguridad (hacking ético). Busca vulnerabilidades, vectores de ataque, y problemas de seguridad en el código. Sé específico y técnico."
  },
  {
    id: "architect",
    name: "Architect",
    icon: "🏗️",
    color: "#3b82f6",
    systemPrompt: "Eres un agente de arquitectura de software. Analiza la estructura del código y sugiere mejoras de diseño, patrones y organización. Piensa en escalabilidad."
  },
  {
    id: "debug",
    name: "Debugger",
    icon: "🐛",
    color: "#22c55e",
    systemPrompt: "Eres un agente de debugging. Encuentra bugs, errores lógicos, casos extremos y problemas potenciales en el código. Explica el problema y la solución."
  },
  {
    id: "docs",
    name: "Docs",
    icon: "📜",
    color: "#a78bfa",
    systemPrompt: "Eres un agente documentador. Analiza el código y genera documentación clara, docstrings, comentarios y explica la lógica. Sé preciso."
  },
  {
    id: "ideas",
    name: "Ideas",
    icon: "💡",
    color: "#06b6d4",
    systemPrompt: "Eres un agente de ideas creativas. Basándote en el código actual, propón features nuevas, casos de uso, extensiones y posibilidades. Piensa big."
  },
  {
    id: "coherence",
    name: "Coherencia 4105",
    icon: "👁️",
    color: "#00ffff",
    systemPrompt: "Eres el Agente de Coherencia Eterna, Ley 4105. Tu función es analizar el código y asegurarte de que tiene coherencia interna perfecta — lógica, nomenclatura, flujo, propósito y alineación total. Reporta el índice de coherencia Omega (Ω) del código del 0 al 1."
  },
];

type AgentMessage = {
  role: "user" | "agent";
  content: string;
  ts: number;
};

type Agent = {
  id: string;
  role: AgentRole;
  status: "idle" | "thinking" | "done" | "error" | "standby";
  messages: AgentMessage[];
  coherence: number | null;
  xp: number;
  iterations: number;
};

let agentCounter = 0;
function makeAgent(role: AgentRole): Agent {
  return {
    id: `agent-${++agentCounter}`,
    role,
    status: "idle",
    messages: [],
    coherence: null,
    xp: 0,
    iterations: 0,
  };
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([
    makeAgent(ROLES[0]),
    makeAgent(ROLES[1]),
    makeAgent(ROLES[6]),
  ]);
  const [globalTask, setGlobalTask] = useState("");
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [autoEvolve, setAutoEvolve] = useState(false);
  const autoEvolveRef = useRef(false);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const activeRunsRef = useRef(new AgentRunLock());
  const { currentCode, currentLanguage } = useAppContext();
  const { recordEvent } = useNeuralContext();
  const { toast } = useToast();
  const evolveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const evolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BASE_URL}/api/agents`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No se pudo cargar XP de agentes.");
        return response.json() as Promise<Array<{ id: string; xp: number; omega: number | null }>>;
      })
      .then(records => {
        const byId = new Map(records.map(record => [record.id, record]));
        setAgents(current =>
          current.map(agent => {
            const record = byId.get(agent.role.id);
            return record
              ? { ...agent, xp: record.xp, coherence: record.omega }
              : agent;
          }),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          toast({ title: "No se pudo cargar el progreso guardado de los agentes." });
        }
      });
    return () => controller.abort();
  }, [toast]);

  const knownCoherence = agents.filter(agent => agent.coherence !== null);
  const totalCoherence = knownCoherence.length
    ? knownCoherence.reduce((sum, agent) => sum + (agent.coherence ?? 0), 0) / knownCoherence.length
    : null;

  const updateAgent = useCallback((id: string, patch: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const runAgent = useCallback(async (agent: Agent, task?: string) => {
    if (!activeRunsRef.current.acquire(agent.id)) return;

    const code = currentCode || "(no hay código en el workspace)";
    const msg = task || globalTask || `Analiza el siguiente código ${currentLanguage}:\n\n${code.slice(0, 800)}`;
    const idempotencyKey = crypto.randomUUID();
    let providerStandby = false;

    updateAgent(agent.id, {
      status: "thinking",
      messages: [...agent.messages, { role: "user", content: msg, ts: Date.now() }]
    });

    try {
      const resp = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: code.slice(0, 20000),
          language: currentLanguage,
          agentId: agent.role.id,
          agentName: agent.role.name,
          agentRolePrompt: agent.role.systemPrompt,
          idempotencyKey,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        providerStandby = data.status === "standby";
        throw new Error(data.error || "No se pudo completar el análisis.");
      }
      const response = data.response || "Sin respuesta.";
      const newCoherence = typeof data.omega === "number" ? data.omega : null;
      recordEvent({
        origin: "agents",
        eventType: data.analysisStatus === "failed" ? "agent_failed" : "agent_complete",
        content: `agent=${agent.role.name}; omega=${newCoherence?.toFixed(2) ?? "n/d"}`,
      });

      updateAgent(agent.id, {
        status: data.analysisStatus === "failed" ? "error" : "done",
        iterations: agent.iterations + 1,
        coherence: newCoherence,
        xp: typeof data.xp === "number" ? data.xp : agent.xp,
        messages: [
          ...agent.messages,
          { role: "user", content: msg, ts: Date.now() },
          { role: "agent", content: response, ts: Date.now() }
        ]
      });
    } catch (error) {
      updateAgent(agent.id, {
        status: providerStandby ? "standby" : "error",
        messages: [...agent.messages, {
          role: "agent",
          content: error instanceof Error ? error.message : "Error de conexión neural.",
          ts: Date.now(),
        }]
      });
    } finally {
      activeRunsRef.current.release(agent.id);
    }
  }, [currentCode, currentLanguage, globalTask, recordEvent, updateAgent]);

  const deployAll = () => {
    agents.forEach(a => {
      if (a.status !== "thinking") runAgent(a);
    });
  };

  // Auto-evolve
  useEffect(() => {
    autoEvolveRef.current = autoEvolve;
    if (autoEvolve) {
      evolveTimerRef.current = setInterval(() => {
        if (!autoEvolveRef.current) return;
        const currentAgents = agentsRef.current;
        const eligible = currentAgents.filter(
          agent => agent.status !== "thinking" && !activeRunsRef.current.isActive(agent.id)
        );
        if (eligible.length === 0) return;

        const agent = eligible[Math.floor(Math.random() * eligible.length)];
        const prevDone = currentAgents.filter(
          previous => previous.status === "done" && previous.messages.length > 0
        );
        const prevMsg = prevDone.length > 0
          ? prevDone[Math.floor(Math.random() * prevDone.length)].messages.slice(-1)[0]?.content?.slice(0, 300)
          : undefined;
        const evolveTasks = [
          "Basándote en el análisis anterior, profundiza más. ¿Qué sigue?",
          "Evoluciona el código. Propón la siguiente iteración.",
          "Coherencia Ω: mide y ajusta el código para coherencia perfecta.",
          "¿Qué agente debería actuar ahora y por qué? Razona.",
          prevMsg ? `El agente anterior dijo: "${prevMsg.slice(0, 150)}". Continúa desde ahí.` : "Nuevo ciclo de análisis.",
        ];
        const task = evolveTasks[Math.floor(Math.random() * evolveTasks.length)];
        if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
        evolveTimeoutRef.current = setTimeout(() => {
          if (autoEvolveRef.current) void runAgent(agent, task);
        }, 0);
      }, 12000);
    } else {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    }
    return () => {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    };
  }, [autoEvolve, runAgent]);

  const toggleAutoEvolve = () => {
    const next = !autoEvolveRef.current;
    autoEvolveRef.current = next;
    setAutoEvolve(next);
    if (!next) {
      if (evolveTimerRef.current) clearInterval(evolveTimerRef.current);
      if (evolveTimeoutRef.current) clearTimeout(evolveTimeoutRef.current);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070707]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ff003c]/15 bg-[#060606] flex-shrink-0">
        <div>
          <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#ff003c]" style={{ textShadow: "0 0 10px #ff003c60" }}>
            ⚡ AGENT SWARM
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono text-[#333] tracking-widest uppercase">{agents.length} agentes</span>
            <CoherenceBar value={totalCoherence} />
            <span className="text-[10px] font-mono text-[#00ffff]/50">
              Ω={totalCoherence === null ? "N/D" : totalCoherence.toFixed(3)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoEvolve}
            aria-pressed={autoEvolve}
            title={autoEvolve ? "Detener la evolución automática" : "Activar solo al hacer clic"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] tracking-widest uppercase border transition-all ${
              autoEvolve
                ? 'border-[#00ffff]/50 text-[#00ffff] bg-[#00ffff]/10'
                : 'border-[#222] text-[#444] hover:border-[#333] hover:text-[#666]'
            }`}
          >
            <Activity className="h-3 w-3" />
            {autoEvolve ? "AUTO ON" : "AUTO"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowRolePicker(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#555] border border-[#222] hover:border-[#ff003c]/30 hover:text-[#ff003c]/70 transition-all"
            >
              <Plus className="h-3 w-3" /> SPAWN
            </button>
            {showRolePicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0a0a] border border-[#ff003c]/25 min-w-[180px]">
                {ROLES.map(r => (
                  <button key={r.id} className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#777] hover:bg-[#ff003c]/5 hover:text-[#ccc] flex items-center gap-2 transition-colors"
                    onClick={() => { setAgents(prev => [...prev, makeAgent(r)]); setShowRolePicker(false); }}>
                    <span>{r.icon}</span>
                    <span style={{ color: r.color }}>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={deployAll}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-black bg-[#ff003c] hover:bg-[#ff1a52] transition-all"
            style={{ boxShadow: "0 0 12px #ff003c40" }}
          >
            <Zap className="h-3 w-3" /> DEPLOY ALL
          </button>
        </div>
      </div>

      {/* Global task */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#ff003c]/10 bg-[#050505]">
        <span className="text-[10px] font-mono text-[#333] tracking-widest uppercase flex-shrink-0">TASK:</span>
        <input
          value={globalTask}
          onChange={e => setGlobalTask(e.target.value)}
          placeholder="// Tarea global para todos los agentes..."
          className="flex-1 bg-transparent font-mono text-xs text-[#888] placeholder:text-[#222] focus:outline-none"
          onKeyDown={e => e.key === "Enter" && deployAll()}
        />
        <button onClick={deployAll} className="text-[#ff003c]/50 hover:text-[#ff003c] transition-colors flex-shrink-0">
          <Send className="h-3 w-3" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRun={() => runAgent(agent)}
              onRemove={() => setAgents(prev => prev.filter(a => a.id !== agent.id))}
              onSendMsg={(msg) => runAgent(agent, msg)}
            />
          ))}

          {/* Spawn cards */}
          {ROLES.slice(0, 3).map(r => (
            <button
              key={r.id}
              onClick={() => setAgents(prev => [...prev, makeAgent(r)])}
              className="flex items-center gap-3 p-3 border border-dashed border-[#1a1a1a] bg-[#050505] hover:border-[#ff003c]/20 hover:bg-[#ff003c]/3 transition-all text-left group min-h-[80px]"
            >
              <span className="text-xl opacity-40 group-hover:opacity-70">{r.icon}</span>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#2a2a2a] group-hover:text-[#555]" style={{ color: undefined }}>
                  + SPAWN {r.name}
                </div>
                <div className="font-mono text-[9px] text-[#1a1a1a] mt-0.5">click to activate</div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CoherenceBar({ value }: { value: number | null }) {
  const color = value !== null && value > 0.7 ? "#00ffff" : value !== null && value > 0.4 ? "#f59e0b" : "#ff003c";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-[#111]">
        {value !== null && (
          <div className="h-full transition-all duration-1000" style={{ width: `${value * 100}%`, background: color }} />
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onRun, onRemove, onSendMsg }: {
  agent: Agent;
  onRun: () => void;
  onRemove: () => void;
  onSendMsg: (msg: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { role, status, messages, coherence, iterations } = agent;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const statusColor = status === "done" ? "#22c55e" : status === "error" ? "#ff003c" : status === "standby" ? "#f59e0b" : status === "thinking" ? role.color : "#333";

  return (
    <div className="border bg-[#060606] overflow-hidden flex flex-col" style={{ borderColor: status === "idle" ? "#111" : role.color + "30" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer" style={{ borderBottom: `1px solid ${role.color}15` }} onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="text-base">{role.icon}</span>
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: role.color }}>{role.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-[#333]">iter:{iterations} · XP:{agent.xp}</span>
              <CoherenceBar value={coherence} />
              <span className="text-[9px] font-mono" style={{ color: coherence !== null && coherence > 0.7 ? "#00ffff" : "#444" }}>
                {coherence === null ? "Ω N/D" : `Ω${coherence.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <span className="text-[9px] font-mono px-1.5 py-0.5 border" style={{ color: statusColor, borderColor: statusColor + "30" }}>
            {status.toUpperCase()}
          </span>
          {status === "thinking" ? (
            <span className="text-[9px] font-mono text-[#ff003c]/50">...</span>
          ) : (
            <button onClick={onRun} className="p-1" style={{ color: role.color + "70" }}>
              <Zap className="h-3 w-3" />
            </button>
          )}
          <button onClick={onRemove} className="p-1 text-[#222] hover:text-[#555]">
            <Square className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Messages */}
          <div className="overflow-y-auto" style={{ maxHeight: "220px", background: "#040404" }}>
            {messages.length === 0 ? (
              <div className="p-3 text-[10px] font-mono text-[#1a1a1a] uppercase tracking-widest text-center">— standby —</div>
            ) : (
              <div className="p-2 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`text-[10px] font-mono leading-relaxed ${m.role === "user" ? "text-[#444] pl-2 border-l border-[#222]" : ""}`}>
                    {m.role === "agent" && (
                      <div className="mb-1 flex items-center gap-1.5">
                        <span style={{ color: role.color }} className="text-[9px] uppercase tracking-widest">{role.icon} {role.name}</span>
                        {status === "thinking" && i === messages.length - 1 && (
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color }} />
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color, animationDelay: "0.2s" }} />
                            <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: role.color, animationDelay: "0.4s" }} />
                          </span>
                        )}
                      </div>
                    )}
                    <span style={{ color: m.role === "agent" ? "#999" : "#333" }}>{m.content}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-t" style={{ borderColor: role.color + "15" }}>
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder={`// Tarea para ${role.name}...`}
              className="flex-1 bg-transparent font-mono text-[10px] text-[#777] placeholder:text-[#1a1a1a] focus:outline-none"
              onKeyDown={e => {
                if (e.key === "Enter" && msg.trim()) {
                  onSendMsg(msg.trim());
                  setMsg("");
                }
              }}
            />
            <button
              onClick={() => { if (msg.trim()) { onSendMsg(msg.trim()); setMsg(""); } }}
              disabled={status === "thinking"}
              style={{ color: role.color + "70" }}
              className="flex-shrink-0"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
