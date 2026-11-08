import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { stopSimulation, startSimulation, subscribeToSimulation, getSimulationStatus } from "./lib/coherence_simulator";
import { persistSimulationSample } from "./routes/coherence-simulation";
import { attachMotorTelemetry, publishMotorHighCoherence } from "./routes/motor-telemetry";
import { initializeAgentTelemetry } from "./routes/agent-telemetry-initialization";
import { attachTerminalWS } from "./routes/terminal";
import {
  databaseConfigured,
  databaseConfigurationState,
  neonConfigured,
  neonPool,
  pool,
  startReplicaWorker,
} from "@workspace/db";
import {
  configureNeuralEventNotifier,
  publishRemoteNeuralEvent,
} from "./routes/neural-event-bus.ts";
import {
  loadNeuralEventsSince,
  loadLatestNeuralEventId,
  PostgresNeuralEventTransport,
} from "./routes/neural-event-postgres.ts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const terminalWss = attachTerminalWS(server);
pool.on("error", (error: Error & { code?: string }) => {
  logger.warn(
    { code: error.code ?? "unknown" },
    "PostgreSQL idle client failed; the pool will discard it and the API will remain online",
  );
});
neonPool?.on("error", (error: Error & { code?: string }) => {
  logger.warn(
    { code: error.code ?? "unknown" },
    "Neon replica pool client failed; primary PostgreSQL and the API remain online",
  );
});

const neuralEventTransport = new PostgresNeuralEventTransport({
  pool,
  loadEventsSince: (eventId) => loadNeuralEventsSince(pool, eventId),
  loadLatestEventId: () => loadLatestNeuralEventId(pool),
  onEvent: publishRemoteNeuralEvent,
});
if (databaseConfigured) {
  configureNeuralEventNotifier((eventId) => neuralEventTransport.publish(eventId));
}

const detachMotorTelemetry = attachMotorTelemetry({
  stopSimulation, startSimulation, subscribeToSimulation, getSimulationStatus,
}, publishMotorHighCoherence);
const replicaWorker = databaseConfigured && neonConfigured && neonPool
  ? startReplicaWorker(pool, neonPool, {
      onError: (code) => logger.warn({ code }, "Neon replication worker will retry"),
    })
  : null;
startSimulation(persistSimulationSample);
logger.info("Motor 5.5 iniciado: telemetría autónoma del servidor");

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

let shuttingDown = false;
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

if (databaseConfigured) {
  void neuralEventTransport.start().catch((error: unknown) => {
    logger.warn({ err: error }, "Neural event transport could not start; its retry loop will recover");
  });
} else {
  logger.warn(
    { databaseConfigurationState },
    "PostgreSQL is not configured; terminal and snippet CRUD use process-local memory",
  );
}

async function initializeDatabaseBackedTelemetry() {
  let attempt = 0;
  while (!shuttingDown) {
    try {
      await pool.query("SELECT 1");
      await initializeAgentTelemetry();
      logger.info("Agent telemetry initialized");
      return;
    } catch (error) {
      attempt += 1;
      const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "unknown";
      logger.warn(
        { attempt, delayMs, code },
        "Database-backed telemetry initialization failed; retrying without stopping the API",
      );
      await sleep(delayMs);
    }
  }
}

if (databaseConfigured) {
  void initializeDatabaseBackedTelemetry();
}

let shutdownStarted = false;
async function shutdown(signal: string) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  shuttingDown = true;
  logger.info({ signal }, "Cerrando servidor y pools de PostgreSQL");
  stopSimulation();
  detachMotorTelemetry();
  for (const client of terminalWss.clients) {
    client.terminate();
  }
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Error cerrando el servidor HTTP");
      process.exitCode = 1;
    }
    void neuralEventTransport
      .stop()
      .then(() => new Promise<void>((resolve) => terminalWss.close(() => resolve())))
      .then(() => replicaWorker?.stop())
      .then(() => Promise.allSettled([pool.end(), neonPool?.end()]))
      .then(() => logger.info("Pools de PostgreSQL cerrados"))
      .catch((poolError) => {
        logger.error({ err: poolError }, "Error cerrando el pool de PostgreSQL");
        process.exitCode = 1;
      });
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
