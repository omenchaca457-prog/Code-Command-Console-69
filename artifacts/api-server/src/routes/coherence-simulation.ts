import { Router } from "express";
import { desc, lt } from "drizzle-orm";
import {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  subscribeToSimulation,
  type CoherenceSample,
  type CoherenceSimulator,
} from "../lib/coherence_simulator.ts";

type CoherenceSimulationRouteDependencies = {
  simulator?: CoherenceSimulator;
  persistSample?: (sample: CoherenceSample) => Promise<void>;
  loadLogs?: (limit: number, beforeId?: number) => Promise<SimulationLogPage>;
};

type SimulationLogItem = {
  id: number;
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  createdAt: string;
};

type SimulationLogPage = {
  items: SimulationLogItem[];
  nextBeforeId: number | null;
};

const defaultSimulator: CoherenceSimulator = {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  subscribeToSimulation,
};

async function persistSimulationSample(sample: CoherenceSample): Promise<void> {
  const { db, simulationLogsTable } = await import("@workspace/db");
  await db.insert(simulationLogsTable).values({
    vector: sample.vector,
    coherence: sample.coherence,
    turbulence: sample.turbulence,
    vectorsProcessed: sample.vectorsProcessed,
  });
}

async function loadSimulationLogs(limit: number, beforeId?: number): Promise<SimulationLogPage> {
  const { db, simulationLogsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(simulationLogsTable)
    .where(beforeId === undefined ? undefined : lt(simulationLogsTable.id, beforeId))
    .orderBy(desc(simulationLogsTable.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    nextBeforeId: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export function createCoherenceSimulationRouter({
  simulator = defaultSimulator,
  persistSample = persistSimulationSample,
  loadLogs = loadSimulationLogs,
}: CoherenceSimulationRouteDependencies = {}) {
  const router = Router();

  router.get("/coherence-simulation/logs", async (req, res): Promise<void> => {
    const rawLimit = req.query.limit;
    const rawBeforeId = req.query.beforeId;
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    const beforeId = rawBeforeId === undefined ? undefined : Number(rawBeforeId);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: "El límite debe ser un entero entre 1 y 100." });
      return;
    }
    if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1)) {
      res.status(400).json({ error: "El cursor debe ser un ID positivo válido." });
      return;
    }

    res.json(await loadLogs(limit, beforeId));
  });

  router.get("/coherence-simulation/status", (_req, res) => {
    res.json(simulator.getSimulationStatus());
  });

  router.post("/coherence-simulation/start", (_req, res) => {
    res.json(simulator.startSimulation(persistSample));
  });

  router.post("/coherence-simulation/stop", (_req, res) => {
    res.json(simulator.stopSimulation());
  });

  router.get("/coherence-simulation/stream", (req, res) => {
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`event: status\ndata: ${JSON.stringify(simulator.getSimulationStatus())}\n\n`);

    const unsubscribe = simulator.subscribeToSimulation((sample) => {
      res.write(`event: sample\ndata: ${JSON.stringify(sample)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 20_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}

export default createCoherenceSimulationRouter();
