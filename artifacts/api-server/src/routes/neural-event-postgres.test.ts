import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import {
  PostgresNeuralEventTransport,
} from "./neural-event-postgres.ts";
import type { StreamedNeuralEvent } from "./neural-event-bus.ts";

class FakeListenerClient extends EventEmitter {
  async query(_sql: string): Promise<void> {}
  release(_error?: Error): void {}
}

const makeEvent = (id: number): StreamedNeuralEvent => ({
  id,
  origin: "runner",
  eventType: "execution",
  content: `event-${id}`,
  createdAt: new Date().toISOString(),
});

async function waitFor(assertion: () => boolean) {
  const deadline = Date.now() + 3_500;
  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Timed out waiting for PostgreSQL listener recovery");
}

describe("PostgresNeuralEventTransport recovery", () => {
  it("replays events committed during a listener outage once the connection returns", async () => {
    let rows = [makeEvent(10)];
    const clients: FakeListenerClient[] = [];
    const received: number[] = [];
    const transport = new PostgresNeuralEventTransport({
      pool: {
        connect: async () => {
          const client = new FakeListenerClient();
          clients.push(client);
          return client;
        },
        query: async () => ({ rows: [] }),
      } as never,
      loadLatestEventId: async () => 10,
      loadEventsSince: async (eventId) => rows.filter((event) => event.id > eventId),
      onEvent: (event) => received.push(event.id),
      instanceId: "recovery-test",
    });

    await transport.start();
    assert.equal(clients.length, 1);
    clients[0]!.emit("error", new Error("simulated PostgreSQL interruption"));
    rows = [...rows, makeEvent(11), makeEvent(12)];

    await waitFor(() => clients.length === 2 && received.length === 2);
    clients[1]!.emit("notification", {
      channel: "neural_events_live",
      payload: JSON.stringify({ source: "other-instance", id: 12 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(received, [11, 12]);
    await transport.stop();
  });
});
