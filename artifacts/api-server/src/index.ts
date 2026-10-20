import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { stopSimulation } from "./lib/coherence_simulator";
import { attachTerminalWS } from "./routes/terminal";
import { pool } from "@workspace/db";
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

const neuralEventTransport = new PostgresNeuralEventTransport({
  pool,
  loadEventsSince: (eventId) => loadNeuralEventsSince(pool, eventId),
  loadLatestEventId: () => loadLatestNeuralEventId(pool),
  onEvent: publishRemoteNeuralEvent,
});
configureNeuralEventNotifier((eventId) => neuralEventTransport.publish(eventId));

await neuralEventTransport.start();

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

process.once("SIGTERM", () => {
  logger.info("SIGTERM recibido; cerrando servidor y pool de PostgreSQL");
  stopSimulation();
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
      .then(() => pool.end())
      .then(() => logger.info("Pool de PostgreSQL cerrado"))
      .catch((poolError) => {
        logger.error({ err: poolError }, "Error cerrando el pool de PostgreSQL");
        process.exitCode = 1;
      });
  });
});
