import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import {
  publishNeuralEvent,
  startNeuralEventListener,
  stopNeuralEventListener,
  subscribeNeuralEvents,
} from "./neural-event-bus.ts";

describe("neural event stream bus", () => {
  it("delivers events to live subscribers and stops after unsubscribe", async () => {
    const received: number[] = [];
    const unsubscribe = subscribeNeuralEvents((event) => received.push(event.id));
    await publishNeuralEvent({
      id: 1001,
      origin: "runner",
      eventType: "execution",
      content: "test",
      createdAt: new Date().toISOString(),
    });
    unsubscribe();
    await publishNeuralEvent({
      id: 1002,
      origin: "runner",
      eventType: "execution",
      content: "test",
      createdAt: new Date().toISOString(),
    });
    assert.deepEqual(received, [1001]);
  });

  it("relays PostgreSQL notifications from other API instances to local subscribers", async () => {
    const client = new EventEmitter() as EventEmitter & {
      query: (sql: string) => Promise<void>;
      release: () => void;
    };
    let listening = false;
    client.query = async (sql) => {
      if (sql.startsWith("LISTEN")) listening = true;
      if (sql.startsWith("UNLISTEN")) listening = false;
    };
    client.release = () => undefined;
    const pool = {
      connect: async () => client,
      query: async (_sql: string, values: string[]) => {
        if (listening) {
          client.emit("notification", {
            channel: "neural_events",
            payload: values[1],
          });
        }
      },
    };
    const logger = { info: () => undefined, error: () => undefined };
    const received: number[] = [];
    const unsubscribe = subscribeNeuralEvents((event) => received.push(event.id));
    startNeuralEventListener(pool as never, logger);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await publishNeuralEvent({
      id: 2001,
      origin: "runner",
      eventType: "local",
      content: "published here",
      createdAt: new Date().toISOString(),
    });
    client.emit("notification", {
      channel: "neural_events",
      payload: JSON.stringify({
        id: 2002,
        origin: "agents",
        eventType: "remote",
        content: "published elsewhere",
        createdAt: new Date().toISOString(),
      }),
    });

    assert.deepEqual(received, [2001, 2002]);
    unsubscribe();
    await stopNeuralEventListener();
  });
});
