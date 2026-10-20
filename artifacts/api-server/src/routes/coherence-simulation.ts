import { Router } from "express";
import { db, simulationLogsTable } from "@workspace/db";
import {
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  subscribeToSimulation,
} from "../lib/coherence_simulator";

const router = Router();

router.get("/coherence-simulation/status", (_req, res) => {
  res.json(getSimulationStatus());
});

router.post("/coherence-simulation/start", (_req, res) => {
  res.json(startSimulation(async (sample) => {
    await db.insert(simulationLogsTable).values({
      vector: sample.vector,
      coherence: sample.coherence,
      turbulence: sample.turbulence,
      vectorsProcessed: sample.vectorsProcessed,
    });
  }));
});

router.post("/coherence-simulation/stop", (_req, res) => {
  res.json(stopSimulation());
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
  res.write(`event: status\ndata: ${JSON.stringify(getSimulationStatus())}\n\n`);

  const unsubscribe = subscribeToSimulation((sample) => {
    res.write(`event: sample\ndata: ${JSON.stringify(sample)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
