import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Eye, Activity, RefreshCw } from "lucide-react";
import { useAiChat } from "@workspace/api-client-react";
import { useAppContext } from "@/lib/app-context";
import { useNeuralContext } from "@/lib/neural-context";

type Vec2 = { x: number; y: number };

type NNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  pulse: number;
  pulseDir: number;
  connections: string[];
  energy: number;
  born: number;
  mass: number;
};

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  color: string;
  size: number;
};

type AgentTelemetry = {
  omega: number | null;
  activeAgents: number;
  standbyAgents: number;
  failedAgents: number;
  loading: boolean;
};

const CORE_CONCEPTS = [
  { label: "SQ-AI", color: "#00ffff", radius: 32, mass: 5 },
  { label: "python", color: "#3b82f6", radius: 18, mass: 2 },
  { label: "javascript", color: "#f59e0b", radius: 16, mass: 2 },
  { label: "bash", color: "#22c55e", radius: 14, mass: 1.5 },
  { label: "rust", color: "#f97316", radius: 15, mass: 1.8 },
  { label: "IA", color: "#a78bfa", radius: 17, mass: 2 },
  { label: "seguridad", color: "#ff003c", radius: 16, mass: 2 },
  { label: "algoritmos", color: "#fbbf24", radius: 14, mass: 1.5 },
  { label: "redes", color: "#06b6d4", radius: 13, mass: 1.3 },
  { label: "datos", color: "#10b981", radius: 14, mass: 1.5 },
  { label: "sql", color: "#e879f9", radius: 13, mass: 1.3 },
  { label: "go", color: "#38bdf8", radius: 12, mass: 1.2 },
];

const SPAWN_CONCEPTS = [
  "APIs", "ML", "crypto", "Docker", "nginx", "exploit", "recon",
  "bytes", "kernel", "sockets", "regex", "recursion", "vectores",
  "GPU", "tokens", "embeddings", "grafos", "entropía", "coherencia",
];

function randBetween(a: number, b: number) { return a + Math.random() * (b - a); }

function colorWithAlpha(color: string, opacity: number) {
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;

  const safeOpacity = Number.isFinite(opacity)
    ? Math.max(0, Math.min(1, opacity))
    : 0;
  const alpha = Math.round(safeOpacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${alpha}`;
}

function makeNode(label: string, color: string, radius: number, mass: number, W: number, H: number, born: number): NNode {
  const angle = Math.random() * Math.PI * 2;
  const dist = randBetween(60, Math.min(W, H) * 0.38);
  return {
    id: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label, color, radius, mass,
    x: W / 2 + Math.cos(angle) * dist,
    y: H / 2 + Math.sin(angle) * dist,
    vx: randBetween(-0.4, 0.4),
    vy: randBetween(-0.4, 0.4),
    pulse: 0, pulseDir: 1,
    connections: [],
    energy: 1,
    born,
  };
}

export default function Neural() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const tickRef = useRef(0);
  const [telemetry, setTelemetry] = useState<AgentTelemetry>({
    omega: null, activeAgents: 0, standbyAgents: 0, failedAgents: 0, loading: true,
  });
  const [selectedNode, setSelectedNode] = useState<NNode | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const { currentCode, currentLanguage } = useAppContext();
  const { events, streamStatus } = useNeuralContext();
  const chatMutation = useAiChat();
  const lastAgentEventIdRef = useRef(0);
  const hasSeenInitialEventsRef = useRef(false);
  const recentEventCount = useMemo(() => {
    const cutoff = Date.now() - 5 * 60_000;
    return events.filter((event) => Date.parse(event.createdAt) >= cutoff).length;
  }, [events]);

  const refreshAgentTelemetry = useCallback(async () => {
    try {
      const response = await fetch("/api/agents");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const records = await response.json() as Array<{ omega: number | null; status: string }>;
      const measured = records.map((agent) => agent.omega)
        .filter((omega): omega is number => typeof omega === "number" && Number.isFinite(omega));
      setTelemetry({
        omega: measured.length ? measured.reduce((sum, omega) => sum + omega, 0) / measured.length : null,
        activeAgents: records.filter((agent) => agent.status === "active").length,
        standbyAgents: records.filter((agent) => agent.status === "standby").length,
        failedAgents: records.filter((agent) => agent.status === "failed").length,
        loading: false,
      });
    } catch {
      setTelemetry((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refreshAgentTelemetry();
  }, [refreshAgentTelemetry]);

  useEffect(() => {
    const agentEvents = events.filter((event) => event.origin === "agents");
    if (!hasSeenInitialEventsRef.current) {
      hasSeenInitialEventsRef.current = true;
      lastAgentEventIdRef.current = Math.max(0, ...agentEvents.map((event) => event.id));
      return;
    }
    const latestNewEvent = agentEvents.reduce(
      (latest, event) => event.id > lastAgentEventIdRef.current ? Math.max(latest, event.id) : latest,
      lastAgentEventIdRef.current,
    );
    if (latestNewEvent <= lastAgentEventIdRef.current) return;
    lastAgentEventIdRef.current = latestNewEvent;
    void refreshAgentTelemetry();
  }, [events, refreshAgentTelemetry]);

  const initNodes = useCallback((W: number, H: number) => {
    const now = Date.now();
    const core = CORE_CONCEPTS.map(c => makeNode(c.label, c.color, c.radius, c.mass, W, H, now));
    // Center the core node
    core[0].x = W / 2;
    core[0].y = H / 2;
    core[0].vx = 0;
    core[0].vy = 0;
    // Connect core to all
    core[0].connections = core.slice(1).map(n => n.id);
    // Some random cross-connections
    for (let i = 1; i < core.length; i++) {
      for (let j = i + 1; j < core.length; j++) {
        if (Math.random() < 0.25) {
          core[i].connections.push(core[j].id);
        }
      }
    }
    nodesRef.current = core;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    initNodes(W, H);

    const ctx = canvas.getContext("2d")!;

    let spawnTimer = 0;

    function spawnParticle(x: number, y: number, color: string) {
      for (let i = 0; i < 4; i++) {
        particlesRef.current.push({
          x, y,
          vx: randBetween(-1.5, 1.5),
          vy: randBetween(-1.5, 1.5),
          life: 1,
          color,
          size: randBetween(1, 3),
        });
      }
    }

    function drawFrame() {
      const nodes = nodesRef.current;
      tickRef.current++;
      spawnTimer++;
      // Spawn new node every ~5s
      if (spawnTimer > 300 && nodes.length < 28) {
        spawnTimer = 0;
        const concept = SPAWN_CONCEPTS[Math.floor(Math.random() * SPAWN_CONCEPTS.length)];
        const colors = ["#00ff41", "#ff003c", "#a78bfa", "#06b6d4", "#f59e0b", "#3b82f6"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const newNode = makeNode(concept, color, randBetween(8, 14), 1, W, H, Date.now());
        // Connect to 1-3 existing nodes
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);
        shuffled.slice(0, Math.floor(randBetween(1, 4))).forEach(n => {
          newNode.connections.push(n.id);
        });
        nodes.push(newNode);
        spawnParticle(newNode.x, newNode.y, color);
      }

      // Physics
      const CENTER_X = W / 2;
      const CENTER_Y = H / 2;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.label === "SQ-AI") {
          a.x = CENTER_X;
          a.y = CENTER_Y;
          a.pulse = (a.pulse + 0.04 * a.pulseDir);
          if (a.pulse > 1 || a.pulse < 0) a.pulseDir *= -1;
          continue;
        }
        // Gravity to center
        const dx = CENTER_X - a.x;
        const dy = CENTER_Y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const grav = 0.012 / a.mass;
        a.vx += (dx / dist) * grav;
        a.vy += (dy / dist) * grav;

        // Repel from other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const rdx = a.x - b.x;
          const rdy = a.y - b.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy) + 0.1;
          const minDist = (a.radius + b.radius) * 3.5;
          if (rdist < minDist) {
            const force = (minDist - rdist) / (rdist * a.mass) * 0.15;
            a.vx += (rdx / rdist) * force;
            a.vy += (rdy / rdist) * force;
          }
        }

        // Damping
        a.vx *= 0.97;
        a.vy *= 0.97;
        a.x += a.vx;
        a.y += a.vy;

        // Bounce walls
        if (a.x < a.radius) { a.x = a.radius; a.vx *= -0.5; }
        if (a.x > W - a.radius) { a.x = W - a.radius; a.vx *= -0.5; }
        if (a.y < a.radius) { a.y = a.radius; a.vy *= -0.5; }
        if (a.y > H - a.radius) { a.y = H - a.radius; a.vy *= -0.5; }

        // Pulse
        a.pulse = (a.pulse + 0.025 * a.pulseDir + Math.random() * 0.01);
        if (a.pulse > 1 || a.pulse < 0) a.pulseDir *= -1;
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.vx *= 0.95;
        p.vy *= 0.95;
        return p.life > 0;
      });

      // Draw
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "rgba(255,0,60,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Draw connections
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const node of nodes) {
        for (const connId of node.connections) {
          const target = nodeMap.get(connId);
          if (!target) continue;
          const alpha = 0.15 + node.pulse * 0.15;
          const gradient = ctx.createLinearGradient(node.x, node.y, target.x, target.y);
          gradient.addColorStop(0, colorWithAlpha(node.color, alpha));
          gradient.addColorStop(1, colorWithAlpha(target.color, alpha));
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();

          // Energy particles along connections
          if (tickRef.current % 40 === 0 && Math.random() < 0.3) {
            spawnParticle(
              node.x + (target.x - node.x) * 0.5,
              node.y + (target.y - node.y) * 0.5,
              node.color
            );
          }
        }
      }

      // Draw particles
      for (const p of particlesRef.current) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw nodes
      for (const node of nodes) {
        const glowR = node.radius + 6 + node.pulse * 8;
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius * 0.3, node.x, node.y, glowR);
        glow.addColorStop(0, node.color + "60");
        glow.addColorStop(1, node.color + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Node body
        const bodyGrad = ctx.createRadialGradient(node.x - node.radius * 0.3, node.y - node.radius * 0.3, 0, node.x, node.y, node.radius);
        bodyGrad.addColorStop(0, node.color + "ee");
        bodyGrad.addColorStop(1, node.color + "88");
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(8, node.radius * 0.65)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (node.label === "SQ-AI") {
          ctx.fillStyle = "#000000";
          ctx.font = `bold ${node.radius * 0.5}px 'JetBrains Mono', monospace`;
        }
        ctx.fillText(node.label, node.x, node.y);

        // Label below for smaller nodes
        if (node.radius < 16) {
          ctx.fillStyle = node.color + "cc";
          ctx.font = `${Math.max(8, node.radius * 0.55)}px 'JetBrains Mono', monospace`;
          ctx.textBaseline = "top";
          ctx.fillText(node.label, node.x, node.y + node.radius + 2);
        }
      }

      frameRef.current = requestAnimationFrame(drawFrame);
    }

    frameRef.current = requestAnimationFrame(drawFrame);

    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [initNodes]);

  const seenNeuralEventsRef = useRef(new Set<number>());
  useEffect(() => {
    const nodes = nodesRef.current;
    const core = nodes.find(node => node.label === "SQ-AI");
    if (!core) return;

    for (const event of [...events].reverse()) {
      if (seenNeuralEventsRef.current.has(event.id)) continue;
      seenNeuralEventsRef.current.add(event.id);
      if (nodes.length >= 30) continue;

      const agentName = event.content.match(/agent=([^;]+)/)?.[1]?.trim();
      const language = event.content.match(/language=([^;]+)/)?.[1]?.trim();
      const label = event.origin === "agents"
        ? agentName || "agent"
        : event.origin === "runner"
          ? language || "runner"
          : event.eventType === "ai_query" ? "terminal/ds" : "terminal";
      const color = event.origin === "agents"
        ? "#a78bfa"
        : event.origin === "runner" ? "#22c55e" : "#00ffff";
      if (nodes.length >= 36) {
        const removed = nodes.splice(CORE_CONCEPTS.length, 1)[0];
        if (removed) {
          core.connections = core.connections.filter(id => id !== removed.id);
          for (const existing of nodes) {
            existing.connections = existing.connections.filter(id => id !== removed.id);
          }
        }
      }
      const node = makeNode(label.slice(0, 18), color, 13, 1.4, canvasRef.current?.width ?? 800, canvasRef.current?.height ?? 500, Date.now());
      node.connections.push(core.id);
      node.pulse = 1;
      nodes.push(node);
      core.connections.push(node.id);
      for (let i = 0; i < 4; i += 1) {
        particlesRef.current.push({
          x: node.x,
          y: node.y,
          vx: randBetween(-1.5, 1.5),
          vy: randBetween(-1.5, 1.5),
          life: 1,
          color,
          size: randBetween(1, 3),
        });
      }
    }
  }, [events]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const node of nodesRef.current) {
      const d = Math.sqrt((node.x - mx) ** 2 + (node.y - my) ** 2);
      if (d < node.radius + 8) {
        setSelectedNode(node);
        setAiResponse("");
        // Trigger AI response about this node
        setIsThinking(true);
        chatMutation.mutate({
          data: {
            message: `Ley 4105 — Coherencia Eterna: Analiza el nodo "${node.label}" en la red neural SQ-AI. Describe su función en 2-3 líneas, su energía actual y cómo se conecta con el contexto del código: ${currentCode?.slice(0, 200) || "(vacío)"}`,
            language: currentLanguage
          }
        }, {
          onSuccess: (res) => { setAiResponse(res.response); setIsThinking(false); },
          onError: () => { setAiResponse("Conexión neural interrumpida."); setIsThinking(false); }
        });
        break;
      }
    }
  }, [chatMutation, currentCode, currentLanguage]);

  const evolve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initNodes(canvas.width, canvas.height);
    particlesRef.current = [];
    tickRef.current = 0;
    setSelectedNode(null);
    setAiResponse("");
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#00ffff]/20 bg-[#060606] z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-[#00ffff]" style={{ filter: "drop-shadow(0 0 8px #00ffff)" }} />
          <div>
            <h1 className="text-xs font-mono font-bold tracking-[0.25em] uppercase text-[#00ffff]" style={{ textShadow: "0 0 10px #00ffff60" }}>
              NEURAL — SQ·AI
            </h1>
            <p className="text-[10px] font-mono text-[#333] tracking-widest uppercase">Ley 4105 · Coherencia Eterna · Evolutiva</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span data-testid="status-neural-stream" className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest ${
            streamStatus === "connected" ? "text-[#22c55e]/70" : "text-[#f59e0b]/70"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              streamStatus === "connected" ? "bg-[#22c55e]" : "animate-pulse bg-[#f59e0b]"
            }`} />
            {streamStatus === "connected" ? "SSE EN VIVO" : streamStatus === "connecting" ? "CONECTANDO" : "RECONECTANDO"}
          </span>
          <button
            onClick={evolve}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-[#00ffff]/60 border border-[#00ffff]/20 hover:border-[#00ffff]/60 hover:text-[#00ffff] hover:bg-[#00ffff]/5 transition-all"
          >
            <RefreshCw className="h-3 w-3" /> EVOLVE
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
        />

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute top-3 left-3 w-72 bg-[#060606]/95 border border-[#00ffff]/30 p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-3 rounded-full" style={{ background: selectedNode.color, boxShadow: `0 0 8px ${selectedNode.color}` }} />
              <span className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: selectedNode.color }}>
                {selectedNode.label}
              </span>
              <button onClick={() => setSelectedNode(null)} className="ml-auto text-[#333] hover:text-[#888] font-mono text-[10px]">[x]</button>
            </div>
            <div className="text-[10px] font-mono text-[#555] mb-2 space-y-0.5">
              <div>CONEXIONES: {selectedNode.connections.length}</div>
              <div>RADIO: {selectedNode.radius.toFixed(1)}</div>
              <div>ENERGÍA: {(selectedNode.energy * 100).toFixed(0)}%</div>
            </div>
            {isThinking ? (
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#00ffff]/60">
                <span className="animate-pulse">▶</span> Analizando nodo...
              </div>
            ) : aiResponse ? (
              <p className="text-[11px] font-mono text-[#888] leading-relaxed">{aiResponse}</p>
            ) : null}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 font-mono text-[10px] tracking-wider">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-[#060606]/90 border-t border-[#00ffff]/10">
            <span className="text-[#00ffff]/70">Ω agentes: {telemetry.omega === null ? "N/D" : telemetry.omega.toFixed(3)}</span>
            <span className="text-[#a78bfa]/70">Eventos / 5 min: {recentEventCount}</span>
            <span className="text-[#22c55e]/70">Agentes activos: {telemetry.activeAgents}</span>
            <span className="text-[#f59e0b]/70">Standby: {telemetry.standbyAgents}</span>
            <span className="text-[#ff003c]/70">Fallidos: {telemetry.failedAgents}</span>
            <span className="ml-auto text-[#444]">
              {telemetry.loading ? "Cargando telemetría…" : "Telemetría real · Canvas conceptual"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

