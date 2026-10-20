import { Router } from "express";
import { sql } from "drizzle-orm";
import { AgentCircuitBreaker, AgentCircuitBlockedError, AgentSafetyViolation } from "./agent-circuit-breaker.ts";
import { recordAgentTaskFailure, type AgentTaskStore } from "./agent-task-outcomes.ts";

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
  circuit?: AgentCircuitBreaker;
  onFailure?: (agentId: string, reason: string, open: boolean) => Promise<void>;
};

function validateSimulatedResult(task: SimulatedAgentTask, result: SimulatedAgentTaskResult) {
  if (result.agentId !== task.agentId || result.agentName !== task.agentName ||
      result.vector !== task.vector || result.coherence !== task.coherence ||
      !Number.isFinite(result.omega) || result.omega < 0 || result.omega > 1 || !result.action.trim() ||
      result.status !== "completed" || !Number.isSafeInteger(result.xp) || result.xp < 0) {
    throw new AgentSafetyViolation("Deriva de los parámetros verificables de la tarea sintética.");
  }
}

export async function completePersistedTask(task: SimulatedAgentTask, store?: AgentTaskStore): Promise<SimulatedAgentTaskResult> {
  const result: SimulatedAgentTaskResult = {
    ...task,
    action: AGENT_ROLES[task.agentId]!.action(task.vector, task.coherence),
    omega: 1,
    xp: 0,
    status: "completed",
  };
  validateSimulatedResult(task, result);
  const { agentsTable, db } = store ?? await import("@workspace/db");
  const [agent] = await db
    .insert(agentsTable)
    .values({
      id: task.agentId,
      name: task.agentName,
      xp: 1,
      successfulTasks: 1,
      lastOmega: 1,
      status: "completed",
      lastFailure: null,
    })
    .onConflictDoUpdate({
      target: agentsTable.id,
      set: {
        xp: sql`${agentsTable.xp} + 1`,
        successfulTasks: sql`${agentsTable.successfulTasks} + 1`,
        lastOmega: sql`(${agentsTable.successfulTasks} + 1)::double precision / (${agentsTable.successfulTasks} + ${agentsTable.failedTasks} + 1)`,
        status: "completed",
        lastFailure: null,
        updatedAt: new Date(),
      },
    })
    .returning({ xp: agentsTable.xp, omega: agentsTable.lastOmega });

  return { ...result, xp: agent?.xp ?? 0, omega: agent?.omega ?? 1 };
}

export function createAgentSimulationRouter({
  completeTask = completePersistedTask,
  parseBody = async (body) => {
    const { RunSimulatedAgentAnalysisBody } = await import("@workspace/api-zod");
    return RunSimulatedAgentAnalysisBody.safeParse(body);
  },
  circuit,
  onFailure = recordAgentTaskFailure,
}: AgentSimulationDependencies = {}) {
  const router = Router();

  router.post("/agents/simulated-analysis", async (req, res): Promise<void> => {
    const parsed = await parseBody(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud de análisis simulado inválida." });
      return;
    }

    const role = AGENT_ROLES[parsed.data.agentId];
    if (!/^\d{1,20}$/.test(parsed.data.vector)) {
      res.status(400).json({ error: "Vector decimal inválido." });
      return;
    }
    const vectorValue = BigInt(parsed.data.vector);
    if (!role || vectorValue > 18_446_744_073_709_551_615n) {
      res.status(400).json({ error: "Agente o vector fuera del rango admitido." });
      return;
    }
    if (!Number.isFinite(parsed.data.coherence) || parsed.data.coherence <= 90 || parsed.data.coherence > 100) {
      res.status(400).json({ error: "El análisis solo se activa con coherencia superior a 90%." });
      return;
    }

    const breaker = circuit ?? (await import("./agent-swarm-circuit.ts")).agentSwarmCircuit;
    const task = {
      ...parsed.data,
      agentName: role.name,
    };
    try {
      const result = await breaker.execute(task.agentId, async () => {
        const result = await completeTask(task);
        validateSimulatedResult(task, result);
        return result;
      });
      res.json(result);
    } catch (error) {
      const snapshot = breaker.getSnapshot(task.agentId);
      const blocked = error instanceof AgentCircuitBlockedError;
      const reason = blocked ? error.message : snapshot.lastFailure!;
      if (!blocked) await onFailure(task.agentId, reason, snapshot.state === "OPEN");
      if (snapshot.remainingMs > 0) {
        res.setHeader("Retry-After", Math.ceil(snapshot.remainingMs / 1000));
      }
      res.status(blocked ? 503 : 502).json({
        error: reason,
        status: blocked || snapshot.state === "OPEN" ? "standby" : "failed",
        retryAfterMs: snapshot.remainingMs,
      });
    }
  });

  return router;
}

export default createAgentSimulationRouter();
