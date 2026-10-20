import { randomBytes } from "node:crypto";
import { logger } from "./logger";

export const RESONANCE_MODULUS = 410_542_503n;
export const SIMULATION_INTERVAL_MS = 100;
export const SIMULATION_LOG_INTERVAL_MS = 10_000;

export type CoherenceSample = {
  vector: string;
  coherence: number;
  turbulence: string;
  vectorsProcessed: number;
  timestamp: string;
};

export type SimulationStatus = {
  running: boolean;
  vectorsProcessed: number;
  latest: CoherenceSample | null;
};

type PersistLog = (sample: CoherenceSample) => Promise<void>;

let interval: NodeJS.Timeout | null = null;
let vectorsProcessed = 0;
let latest: CoherenceSample | null = null;
let lastPersistedAt = 0;
let persisting = false;
let persistLog: PersistLog | null = null;
const listeners = new Set<(sample: CoherenceSample) => void>();

function makeSample(): CoherenceSample {
  const vector = randomBytes(8).readBigUInt64BE();
  const turbulenceValue = vector % RESONANCE_MODULUS;
  const coherence = (1 - Number(turbulenceValue) / Number(RESONANCE_MODULUS)) * 100;

  return {
    vector: vector.toString(),
    coherence,
    turbulence: turbulenceValue.toString(),
    vectorsProcessed,
    timestamp: new Date().toISOString(),
  };
}

export function subscribeToSimulation(listener: (sample: CoherenceSample) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSimulationStatus(): SimulationStatus {
  return { running: interval !== null, vectorsProcessed, latest };
}

export function startSimulation(saveLog: PersistLog): SimulationStatus {
  if (interval) return getSimulationStatus();

  persistLog = saveLog;
  lastPersistedAt = Date.now();
  interval = setInterval(() => {
    vectorsProcessed += 1;
    const sample = makeSample();
    latest = sample;

    for (const listener of listeners) {
      try {
        listener(sample);
      } catch (error) {
        logger.warn({ err: error }, "Simulation subscriber failed");
      }
    }

    if (Date.now() - lastPersistedAt >= SIMULATION_LOG_INTERVAL_MS && !persisting && persistLog) {
      lastPersistedAt = Date.now();
      persisting = true;
      void persistLog(sample)
        .catch((error: unknown) => {
          logger.error({ err: error }, "Could not persist coherence simulation log");
        })
        .finally(() => {
          persisting = false;
        });
    }
  }, SIMULATION_INTERVAL_MS);

  return getSimulationStatus();
}

export function stopSimulation(): SimulationStatus {
  if (interval) clearInterval(interval);
  interval = null;
  persistLog = null;
  return getSimulationStatus();
}
