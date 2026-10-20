import { Router } from "express";
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

export function createCoherenceSimulationRouter({
  simulator = defaultSimulator,
  persistSample = persistSimulationSample,
}: CoherenceSimulationRouteDependencies = {}) {
  const router = Router();

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
