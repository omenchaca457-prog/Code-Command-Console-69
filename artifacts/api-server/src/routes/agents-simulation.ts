import { Router } from "express";
import { eq, sql } from "drizzle-orm";

type ParsedSimulationBody =
  | { success: true; data: { agentId: string; vector: string; coherence: number } }
  | { success: false };
type ParseSimulationBody = (body: unknown) => Promise<ParsedSimulationBody> | ParsedSimulationBody;

type AgentRole = {
  name: string;
  action: (vector: string, coherence: number) => string;
};

const AGENT_ROLES: Record<string, AgentRole> = {
  optimizer: {
    name: "Optimizer",
    action: (vector) => `Análisis sintético: vector ${vector} procesado como dato decimal; no se detectó una operación redundante.`,
  },
  security: {
    name: "Security",
    action: (vector) => `Validación sintética: vector ${vector} está dentro del rango uint64 y se trata como dato, no como carga ejecutable.`,
  },
  architect: {
    name: "Architect",
    action: (vector) => `Revisión sintética: vector ${vector} conserva una representación decimal estable para el flujo.`,
  },
  debug: {
    name: "Debugger",
    action: (vector) => `Comprobación sintética: vector ${vector} fue recibido y su residuo puede calcularse sin pérdida de precisión.`,
  },
  docs: {
    name: "Docs",
    action: (vector, coherence) => `Registro sintético: vector ${vector} recibido con coherencia ${coherence.toFixed(2)}%.`,
  },
  ideas: {
    name: "Ideas",
    action: (vector, coherence) => `Propuesta sintética: comparar el vector ${vector} con la siguiente muestra de coherencia ${coherence.toFixed(2)}%.`,
  },
  coherence: {
    name: "Coherencia 4105",
    action: (vector, coherence) => `Medición sintética: vector ${vector}; coherencia normalizada ${coherence.toFixed(2)}%.`,
  },
};

export type SimulatedAgentTask = {
  agentId: string;
  agentName: string;
  vector: string;
  coherence: number;
};

export type SimulatedAgentTaskResult = SimulatedAgentTask & {
  action: string;
  omega: number;
  xp: number;
  status: "completed";
};

export type AgentSimulationDependencies = {
  completeTask?: (task: SimulatedAgentTask) => Promise<SimulatedAgentTaskResult>;
  parseBody?: ParseSimulationBody;
};

async function completePersistedTask(task: SimulatedAgentTask): Promise<SimulatedAgentTaskResult> {
  const { agentsTable, db } = await import("@workspace/db");
  const omega = Math.min(1, Math.max(0, task.coherence / 100));
  const [agent] = await db
    .insert(agentsTable)
    .values({
      id: task.agentId,
      name: task.agentName,
      xp: 1,
      lastOmega: omega,
      status: "completed",
      lastFailure: null,
    })
    .onConflictDoUpdate({
      target: agentsTable.id,
      set: {
        xp: sql`${agentsTable.xp} + 1`,
        lastOmega: omega,
        status: "completed",
        lastFailure: null,
        updatedAt: new Date(),
      },
    })
    .returning({ xp: agentsTable.xp });

  return {
    ...task,
    action: AGENT_ROLES[task.agentId]!.action(task.vector, task.coherence),
    omega,
    xp: agent?.xp ?? 0,
    status: "completed",
  };
}

export function createAgentSimulationRouter({
  completeTask = completePersistedTask,
  parseBody = async (body) => {
    const { RunSimulatedAgentAnalysisBody } = await import("@workspace/api-zod");
    return RunSimulatedAgentAnalysisBody.safeParse(body);
  },
}: AgentSimulationDependencies = {}) {
  const router = Router();

  router.post("/agents/simulated-analysis", async (req, res): Promise<void> => {
    const parsed = await parseBody(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud de análisis simulado inválida." });
      return;
    }

    const role = AGENT_ROLES[parsed.data.agentId];
    const vectorValue = BigInt(parsed.data.vector);
    if (!role || vectorValue > 18_446_744_073_709_551_615n) {
      res.status(400).json({ error: "Agente o vector fuera del rango admitido." });
      return;
    }
    if (parsed.data.coherence <= 90 || parsed.data.coherence > 100) {
      res.status(400).json({ error: "El análisis solo se activa con coherencia superior a 90%." });
      return;
    }

    const result = await completeTask({
      agentId: parsed.data.agentId,
      agentName: role.name,
      vector: parsed.data.vector,
      coherence: parsed.data.coherence,
    });
    res.json(result);
  });

  return router;
}

export default createAgentSimulationRouter();
