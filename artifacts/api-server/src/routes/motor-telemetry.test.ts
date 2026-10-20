import assert from "node:assert/strict";
import { it } from "node:test";
import { attachMotorTelemetry } from "./motor-telemetry.ts";
import { createCoherenceSimulator, type CoherenceSample } from "../lib/coherence_simulator.ts";

it("emits high_coherence on the server with no browser and isolates transient generation/subscriber failures", async () => {
  let tick!: () => void;
  let now = 0;
  let generationFails = true;
  const simulator = createCoherenceSimulator({
    now: () => now,
    createVector: () => { if (generationFails) throw new Error("Test entropy failure"); return 1234n; },
    setInterval: ((callback: () => void) => { tick = callback; return 1; }) as unknown as typeof setInterval,
    clearInterval: (() => {}) as typeof clearInterval,
  });
  const events: CoherenceSample[] = [];
  const detach = attachMotorTelemetry(simulator, async sample => { events.push(sample); }, () => now);
  simulator.subscribeToSimulation(() => { throw new Error("Test failed subscriber"); });
  simulator.startSimulation(async () => {});
  tick();
  assert.equal(simulator.getSimulationStatus().running, true);
  generationFails = false;
  for (let i = 0; i < 3; i++) {
    now += 1000;
    tick();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(events.length, 3);
  assert.equal(simulator.getSimulationStatus().vectorsProcessed, 3);
  detach();
  simulator.stopSimulation();
});
