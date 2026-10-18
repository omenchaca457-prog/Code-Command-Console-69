import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { StreamedNeuralEvent } from "./neural-event-bus.ts";
import { logger } from "../lib/logger.ts";

const CHANNEL = "neural_events_live";
const RECONNECT_DELAY_MS = 1_000;

type NeuralEventRow = {
  id: number;
  origin: StreamedNeuralEvent["origin"];
  event_type: string;
  content: string;
  created_at: Date | string;
};

type PostgresNeuralEventTransportOptions = {
  pool: Pick<Pool, "connect" | "query">;
  loadLatestEventId: () => Promise<number>;
  loadEventsSince: (eventId: number) => Promise<StreamedNeuralEvent[]>;
  onEvent: (event: StreamedNeuralEvent) => void;
  instanceId?: string;
};

export class PostgresNeuralEventTransport {
  private readonly instanceId: string;
  private readonly options: PostgresNeuralEventTransportOptions;
  private listener: PoolClient | null = null;
  private listenerFailure: ((error?: Error) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = true;
  private remoteNotifications = Promise.resolve();
  private recoveryPromise = Promise.resolve();
  private replayCursor: number | null = null;
  private readonly seenEventIds = new Set<number>();

  constructor(options: PostgresNeuralEventTransportOptions) {
    this.options = options;
    this.instanceId = options.instanceId ?? randomUUID();
  }

  async start(): Promise<void> {
    if (!this.stopping && this.listener) return;
    this.stopping = false;
    try {
      await this.connectListener();
    } catch (error) {
      logger.error(
        { err: error },
        "No se pudo iniciar LISTEN para eventos neuronales; se reintentará",
      );
      this.scheduleReconnect();
    }
  }

  async publish(eventId: number): Promise<void> {
    this.seenEventIds.add(eventId);
    await this.options.pool.query(
      "SELECT pg_notify($1, $2)",
      [CHANNEL, JSON.stringify({ source: this.instanceId, id: eventId })],
    );
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const client = this.listener;
    this.listener = null;
    if (!client) return;

    client.removeListener("notification", this.handleNotification);
    if (this.listenerFailure) {
      client.removeListener("error", this.listenerFailure);
      client.removeListener("end", this.listenerFailure);
      this.listenerFailure = null;
    }

    try {
      await client.query(`UNLISTEN ${CHANNEL}`);
    } finally {
      client.release();
    }
  }

  private async connectListener(): Promise<void> {
    if (this.replayCursor === null) {
      this.replayCursor = await this.options.loadLatestEventId();
    }

    const client = await this.options.pool.connect();
    try {
      await client.query(`LISTEN ${CHANNEL}`);
    } catch (error) {
      client.release(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    if (this.stopping) {
      client.release();
      return;
    }

    this.listener = client;
    this.listenerFailure = (error) => {
      if (this.listener !== client) return;
      logger.warn(
        { err: error, channel: CHANNEL },
        "Se perdió la conexión de escucha de eventos neuronales",
      );
      this.listener = null;
      client.removeListener("notification", this.handleNotification);
      client.removeListener("error", this.listenerFailure!);
      client.removeListener("end", this.listenerFailure!);
      this.listenerFailure = null;
      client.release(error ?? new Error("Conexión LISTEN terminada"));
      this.scheduleReconnect();
    };
    client.on("notification", this.handleNotification);
    client.on("error", this.listenerFailure);
    client.on("end", this.listenerFailure);

    this.recoveryPromise = this.replayMissedEvents();
    try {
      await this.recoveryPromise;
    } catch (error) {
      this.listenerFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async replayMissedEvents(): Promise<void> {
    const cursor = this.replayCursor;
    if (cursor === null) return;

    const missed = await this.options.loadEventsSince(cursor);
    for (const event of missed.sort((left, right) => left.id - right.id)) {
      this.deliverOnce(event);
    }
  }

  private deliverOnce(event: StreamedNeuralEvent): void {
    if (this.seenEventIds.has(event.id)) return;
    this.seenEventIds.add(event.id);
    this.options.onEvent(event);
  }

  private readonly handleNotification = (message: {
    channel?: string;
    payload?: string;
  }) => {
    if (message.channel !== CHANNEL || !message.payload) return;

    this.remoteNotifications = this.remoteNotifications
      .then(() => this.recoveryPromise)
      .then(async () => {
        const notification = JSON.parse(message.payload!) as {
          source?: unknown;
          id?: unknown;
        };
        if (notification.source === this.instanceId) return;
        if (
          typeof notification.id !== "number" ||
          !Number.isSafeInteger(notification.id) ||
          notification.id <= 0
        ) {
          logger.warn({ payload: message.payload }, "Aviso de evento neuronal inválido");
          return;
        }

        // Replay from the stable startup cursor so concurrent transactions with
        // lower sequence IDs are still recovered; seenEventIds removes duplicates.
        await this.replayMissedEvents();
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "No se pudo procesar un aviso de evento neuronal");
      });
  };

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectListener().catch((error: unknown) => {
        logger.error({ err: error }, "No se pudo restablecer LISTEN para eventos neuronales");
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }
}

function mapNeuralEventRow(row: NeuralEventRow): StreamedNeuralEvent {
  return {
    id: Number(row.id),
    origin: row.origin,
    eventType: row.event_type,
    content: row.content,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

export async function loadLatestNeuralEventId(
  pool: Pick<Pool, "query">,
): Promise<number> {
  const { rows } = await pool.query<{ id: number | string | null }>(
    "SELECT MAX(id) AS id FROM neural_events",
  );
  const id = Number(rows[0]?.id ?? 0);
  if (!Number.isSafeInteger(id) || id < 0) {
    throw new Error("El ID máximo de eventos neuronales no es válido");
  }
  return id;
}

export async function loadNeuralEventsSince(
  pool: Pick<Pool, "query">,
  eventId: number,
): Promise<StreamedNeuralEvent[]> {
  const { rows } = await pool.query<NeuralEventRow>(
    `SELECT id, origin, event_type, content, created_at
     FROM neural_events
     WHERE id > $1
     ORDER BY id ASC`,
    [eventId],
  );
  return rows.map(mapNeuralEventRow);
}
