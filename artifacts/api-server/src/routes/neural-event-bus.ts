import { EventEmitter } from "node:events";
import { neuralEventHub } from "./neural-event-hub.ts";

export type StreamedNeuralEvent = {
  id: number;
  origin: "terminal" | "runner" | "agents";
  eventType: string;
  content: string;
  createdAt: string;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);
const CHANNEL = "neural_events";
type ListenerClient = {
  on: (...args: any[]) => unknown;
  query: (sql: string) => Promise<unknown>;
  release: (destroy?: boolean) => void;
};
type PgPoolAdapter = {
  connect: () => Promise<ListenerClient>;
  query: (sql: string, values: string[]) => Promise<unknown>;
};
type LoggerAdapter = {
  info: (message: string) => void;
  error: (details: unknown, message: string) => void;
};
let pool: PgPoolAdapter | null = null;
let logger: LoggerAdapter | null = null;
let listenerClient: ListenerClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connecting = false;
let listenerEnabled = false;
const localPublishIds = new Set<number>();

function receiveNotification(payload: string | undefined) {
  if (!payload) return;
  try {
    const event = JSON.parse(payload) as StreamedNeuralEvent;
    if (!Number.isSafeInteger(event.id) || typeof event.content !== "string") return;
    if (localPublishIds.delete(event.id)) return;
    neuralEventHub.publish(event);
    emitter.emit("event", event);
  } catch (error) {
    logger?.error({ err: error }, "No se pudo leer una notificación de actividad neuronal");
  }
}

function scheduleReconnect() {
  if (!listenerEnabled || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startNeuralEventListener();
  }, 2_000);
}

export function startNeuralEventListener(databasePool?: PgPoolAdapter, serviceLogger?: LoggerAdapter) {
  if (databasePool) {
    pool = databasePool;
    listenerEnabled = true;
  }
  if (serviceLogger) logger = serviceLogger;
  if (connecting || listenerClient || !pool || !listenerEnabled) return;
  connecting = true;
  void pool.connect().then(async (client) => {
    listenerClient = client;
    client.on("notification", (message: { channel?: string; payload?: string }) => {
      const notification = message;
      if (notification.channel === CHANNEL) receiveNotification(notification.payload);
    });
    client.on("error", (error: unknown) => {
      logger?.error({ err: error }, "Conexión LISTEN de actividad neuronal interrumpida");
      if (listenerClient === client) {
        listenerClient = null;
        client.release(true);
        scheduleReconnect();
      }
    });
    try {
      await client.query(`LISTEN ${CHANNEL}`);
      logger?.info("Suscrito a notificaciones PostgreSQL de actividad neuronal");
    } catch (error) {
      if (listenerClient === client) listenerClient = null;
      client.release(true);
      logger?.error({ err: error }, "No se pudo iniciar LISTEN de actividad neuronal");
      scheduleReconnect();
    }
  }).catch((error: unknown) => {
    logger?.error({ err: error }, "No se pudo conectar a LISTEN de actividad neuronal");
    scheduleReconnect();
  }).finally(() => {
    connecting = false;
  });
}

export async function stopNeuralEventListener() {
  listenerEnabled = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const client = listenerClient;
  listenerClient = null;
  if (client) {
    await client.query(`UNLISTEN ${CHANNEL}`).catch(() => undefined);
    client.release();
  }
  pool = null;
  logger = null;
}

export async function publishNeuralEvent(event: StreamedNeuralEvent) {
  localPublishIds.add(event.id);
  if (localPublishIds.size > 2_000) {
    const oldest = localPublishIds.values().next().value;
    if (oldest !== undefined) localPublishIds.delete(oldest);
  }
  neuralEventHub.publish(event);
  emitter.emit("event", event);
  if (!pool) return;
  try {
    await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(event)]);
  } catch (error) {
    logger?.error({ err: error, eventId: event.id }, "No se pudo distribuir actividad neuronal a otras instancias");
  }
}

export function subscribeNeuralEvents(listener: (event: StreamedNeuralEvent) => void) {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
