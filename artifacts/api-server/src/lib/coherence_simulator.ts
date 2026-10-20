import { randomBytes } from "node:crypto";
import { logger } from "./logger.ts";

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

export type CoherenceSimulator = {
  subscribeToSimulation(listener: (sample: CoherenceSample) => void): () => void;
  getSimulationStatus(): SimulationStatus;
  startSimulation(saveLog: PersistLog): SimulationStatus;
  stopSimulation(): SimulationStatus;
};

export type CoherenceSimulatorDependencies = {
  now?: () => number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  createVector?: () => bigint;
};

export function createCoherenceSimulator(
  dependencies: CoherenceSimulatorDependencies = {},
): CoherenceSimulator {
  const now = dependencies.now ?? Date.now;
  const schedule = dependencies.setInterval ?? setInterval;
  const cancel = dependencies.clearInterval ?? clearInterval;
  const createVector = dependencies.createVector ?? (() => randomBytes(8).readBigUInt64BE());
  let interval: ReturnType<typeof setInterval> | null = null;
  let vectorsProcessed = 0;
  let latest: CoherenceSample | null = null;
  let lastPersistedAt = 0;
  let persisting = false;
  let persistLog: PersistLog | null = null;
  const listeners = new Set<(sample: CoherenceSample) => void>();

  function makeSample(): CoherenceSample {
    const vector = createVector();
    const turbulenceValue = vector % RESONANCE_MODULUS;
    const coherence = (1 - Number(turbulenceValue) / Number(RESONANCE_MODULUS)) * 100;

    return {
      vector: vector.toString(),
      coherence,
      turbulence: turbulenceValue.toString(),
      vectorsProcessed,
      timestamp: new Date(now()).toISOString(),
    };
  }

  function getSimulationStatus(): SimulationStatus {
    return { running: interval !== null, vectorsProcessed, latest };
  }

  function startSimulation(saveLog: PersistLog): SimulationStatus {
    if (interval !== null) return getSimulationStatus();

    persistLog = saveLog;
    lastPersistedAt = now();
    interval = schedule(() => {
      try {
        const sample = makeSample();
        vectorsProcessed += 1;
        sample.vectorsProcessed = vectorsProcessed;
        latest = sample;

        for (const listener of listeners) {
          try {
            listener(sample);
          } catch (error) {
            logger.warn({ err: error }, "Simulation subscriber failed");
          }
        }

        if (now() - lastPersistedAt >= SIMULATION_LOG_INTERVAL_MS && !persisting && persistLog) {
          lastPersistedAt = now();
          persisting = true;
          try {
            void persistLog(sample)
              .catch((error: unknown) => {
                logger.error({ err: error }, "Could not persist coherence simulation log");
              })
              .finally(() => { persisting = false; });
          } catch (error) {
            persisting = false;
            throw error;
          }
        }
      } catch (error) {
        logger.error({ err: error }, "Motor 5.5: fallo del ciclo; se reintentará en el siguiente tick");
      }
    }, SIMULATION_INTERVAL_MS);

    return getSimulationStatus();
  }

  function stopSimulation(): SimulationStatus {
    if (interval !== null) cancel(interval);
    interval = null;
    persistLog = null;
    return getSimulationStatus();
  }

  return {
    subscribeToSimulation(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSimulationStatus,
    startSimulation,
    stopSimulation,
  };
}

const defaultSimulator = createCoherenceSimulator();

export const getSimulationStatus = defaultSimulator.getSimulationStatus;
export const subscribeToSimulation = defaultSimulator.subscribeToSimulation;
export const stopSimulation = defaultSimulator.stopSimulation;
export const startSimulation = defaultSimulator.startSimulation;
