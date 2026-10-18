import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import express, { type Router } from "express";
import { describe, it } from "node:test";
import {
  NeuralEventHub,
  type NeuralEventRecord,
} from "./neural-event-hub.ts";
import { createNeuralEventsStreamRouter } from "./neural-events-stream.ts";
import {
  configureNeuralEventNotifier,
  publishNeuralEvent,
  type StreamedNeuralEvent,
} from "./neural-event-bus.ts";
import { PostgresNeuralEventTransport } from "./neural-event-postgres.ts";
import type { Pool } from "pg";

function event(id: number): StreamedNeuralEvent {
  return {
    id,
    origin: "runner",
    eventType: "run_complete",
    content: `run ${id}`,
    createdAt: `2026-10-18T00:00:${String(id).padStart(2, "0")}.000Z`,
  };
}

async function withServer(router: Router, run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: () => undefined } });
    next();
  });
  app.use("/api", router);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

function createSseReader(response: Response) {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return {
    async nextEvent(): Promise<NeuralEventRecord> {
      while (true) {
        const frameEnd = buffer.indexOf("\n\n");
        if (frameEnd >= 0) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);
          const id = frame.match(/^id: (.+)$/m)?.[1];
          const data = frame.match(/^data: (.+)$/m)?.[1];
          assert.ok(id, `El frame SSE no incluye id: ${frame}`);
          assert.ok(data, `El frame SSE no incluye data: ${frame}`);
          const event = JSON.parse(data) as NeuralEventRecord;
          assert.equal(Number(id), event.id, "El id SSE debe coincidir con el ID del evento");
          return event;
        }

        const { done, value } = await reader.read();
        assert.equal(done, false, "El flujo SSE terminó antes de entregar el evento");
        buffer += decoder.decode(value, { stream: true });
      }
    },
    cancel: () => reader.cancel(),
  };
}

class FakePgListener extends EventEmitter {
  channel: string | null = null;
  private readonly remove: (client: FakePgListener) => void;

  constructor(remove: (client: FakePgListener) => void) {
    super();
    this.remove = remove;
  }

  async query(statement: string): Promise<void> {
    const listen = statement.match(/^(LISTEN|UNLISTEN) ([a-z_]+)$/);
    if (listen) this.channel = listen[1] === "LISTEN" ? listen[2] : null;
  }

  release(): void {
    this.remove(this);
  }
}

class FakeSharedPostgres {
  readonly rows = new Map<number, StreamedNeuralEvent>();
  readonly listeners = new Set<FakePgListener>();
  readonly pool = {
    connect: async () => {
      const client = new FakePgListener((listener) => this.listeners.delete(listener));
      this.listeners.add(client);
      return client;
    },
    query: async (statement: string, values?: unknown[]) => {
      assert.match(statement, /pg_notify/);
      const [channel, payload] = values ?? [];
      for (const client of this.listeners) {
        if (client.channel === channel) {
          client.emit("notification", { channel, payload });
        }
      }
      return { rows: [] };
    },
  } as unknown as Pick<Pool, "connect" | "query">;

  async loadEvent(eventId: number): Promise<StreamedNeuralEvent | null> {
    return this.rows.get(eventId) ?? null;
  }
}

describe("GET /api/neural-events/stream", () => {
  it("delivers events over HTTP and replays only those after Last-Event-ID on reconnect", async () => {
    const persisted = [event(41)];
    const replayCursors: number[] = [];
    const hub = new NeuralEventHub();
    const router = createNeuralEventsStreamRouter({
      hub,
      loadEventsSince: async (cursor) => {
        replayCursors.push(cursor);
        return persisted.filter((item) => item.id > cursor);
      },
    });

    await withServer(router, async (baseUrl) => {
      const firstResponse = await fetch(`${baseUrl}/api/neural-events/stream`);
      assert.equal(firstResponse.status, 200);
      assert.match(
        firstResponse.headers.get("content-type") ?? "",
        /^text\/event-stream; charset=utf-8$/,
      );
      assert.equal(firstResponse.headers.get("cache-control"), "no-cache, no-transform");
      assert.equal(firstResponse.headers.get("connection"), "keep-alive");
      assert.equal(firstResponse.headers.get("x-accel-buffering"), "no");

      const firstStream = createSseReader(firstResponse);
      assert.deepEqual(await firstStream.nextEvent(), event(41));
      await firstStream.cancel();

      persisted.push(event(42), event(43));

      const reconnectResponse = await fetch(`${baseUrl}/api/neural-events/stream`, {
        headers: { "Last-Event-ID": "41" },
      });
      assert.equal(reconnectResponse.status, 200);
      const reconnectStream = createSseReader(reconnectResponse);
      const replayed = [
        await reconnectStream.nextEvent(),
        await reconnectStream.nextEvent(),
      ];
      assert.deepEqual(replayed, [event(42), event(43)]);
      await reconnectStream.cancel();
    });

    assert.deepEqual(replayCursors, [0, 41]);
  });

  it("delivers a writer instance's event to a client connected to another instance", async () => {
    const postgres = new FakeSharedPostgres();
    const readerHub = new NeuralEventHub();
    const writer = new PostgresNeuralEventTransport({
      pool: postgres.pool,
      loadEvent: (id) => postgres.loadEvent(id),
      onEvent: (item) => readerHub.publish(item),
      instanceId: "writer-instance",
    });
    const reader = new PostgresNeuralEventTransport({
      pool: postgres.pool,
      loadEvent: (id) => postgres.loadEvent(id),
      onEvent: (item) => readerHub.publish(item),
      instanceId: "reader-instance",
    });
    const persistedEvent = event(77);

    await Promise.all([writer.start(), reader.start()]);
    configureNeuralEventNotifier((id) => writer.publish(id));
    let replayStarted!: () => void;
    const replayStartedPromise = new Promise<void>((resolve) => {
      replayStarted = resolve;
    });
    const router = createNeuralEventsStreamRouter({
      hub: readerHub,
      loadEventsSince: async (cursor) => {
        replayStarted();
        return [...postgres.rows.values()].filter((item) => item.id > cursor);
      },
    });

    try {
      await withServer(router, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/neural-events/stream`);
        const stream = createSseReader(response);
        await replayStartedPromise;
        postgres.rows.set(persistedEvent.id, persistedEvent);
        await publishNeuralEvent({
          ...persistedEvent,
          createdAt: String(persistedEvent.createdAt),
        });
        assert.deepEqual(await stream.nextEvent(), persistedEvent);
        await stream.cancel();
      });
    } finally {
      configureNeuralEventNotifier(async () => undefined);
      await Promise.all([writer.stop(), reader.stop()]);
    }
  });
});
