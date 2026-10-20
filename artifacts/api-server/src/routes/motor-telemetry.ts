import { logger } from "../lib/logger.ts";
import type { CoherenceSample, CoherenceSimulator } from "../lib/coherence_simulator.ts";

/** Server-owned emission; never depends on an open browser tab. */
export function attachMotorTelemetry(
  simulator: CoherenceSimulator,
  publish: (sample: CoherenceSample) => Promise<void>,
  now = Date.now,
) {
  let pending = false;
  let lastEmission = -Infinity;
  return simulator.subscribeToSimulation((sample) => {
    if (sample.coherence <= 95 || pending || now() - lastEmission < 1000) return;
    pending = true;
    lastEmission = now();
    void Promise.resolve().then(() => publish(sample))
      .catch((err: unknown) => logger.error({ err }, "Motor 5.5: no se pudo publicar high_coherence"))
      .finally(() => { pending = false; });
  });
}

export async function publishMotorHighCoherence(sample: CoherenceSample) {
  const { db, neuralEventsTable } = await import("@workspace/db");
  const { publishNeuralEvent } = await import("./neural-event-bus.ts");
  const [event] = await db.insert(neuralEventsTable).values({
    origin: "motor",
    eventType: "high_coherence",
    content: `ALTA COHERENCIA: ${sample.coherence.toFixed(4)}% · vector ${sample.vectorsProcessed} · ${sample.timestamp}`,
  }).returning();
  await publishNeuralEvent({
    ...event,
    origin: "motor",
    createdAt: event.createdAt.toISOString(),
  });
}
