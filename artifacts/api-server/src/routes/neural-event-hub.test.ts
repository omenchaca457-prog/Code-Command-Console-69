import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NeuralEventHub, type NeuralEventRecord } from "./neural-event-hub.ts";

function event(id: number): NeuralEventRecord {
  return {
    id,
    origin: "runner",
    eventType: "run_complete",
    content: `run ${id}`,
    createdAt: new Date(`2026-10-18T00:00:${String(id).padStart(2, "0")}.000Z`),
  };
}

describe("NeuralEventHub", () => {
  it("replays missed events after a disconnected client reconnects without duplicates", async () => {
    const hub = new NeuralEventHub();
    const persisted = [event(1)];
    const firstClient: NeuralEventRecord[] = [];
    const first = hub.subscribe(
      0,
      async (afterId) => persisted.filter((item) => item.id > afterId),
      (item) => firstClient.push(item),
    );
    await first.ready;
    assert.deepEqual(firstClient.map((item) => item.id), [1]);
    first.unsubscribe();

    persisted.push(event(2));
    const reconnectedClient: NeuralEventRecord[] = [];
    const reconnected = hub.subscribe(
      1,
      async (afterId) => persisted.filter((item) => item.id > afterId),
      (item) => reconnectedClient.push(item),
    );
    await reconnected.ready;
    hub.publish(event(2));
    hub.publish(event(3));

    assert.deepEqual(reconnectedClient.map((item) => item.id), [2, 3]);
    reconnected.unsubscribe();
  });

  it("buffers live events during replay and emits each ID once in order", async () => {
    const hub = new NeuralEventHub();
    const received: number[] = [];
    let finishReplay!: (events: NeuralEventRecord[]) => void;
    const replay = new Promise<NeuralEventRecord[]>((resolve) => {
      finishReplay = resolve;
    });

    const subscription = hub.subscribe(0, () => replay, (item) => received.push(item.id));
    hub.publish(event(2));
    finishReplay([event(1), event(2)]);
    await subscription.ready;
    hub.publish(event(2));
    hub.publish(event(3));

    assert.deepEqual(received, [1, 2, 3]);
    subscription.unsubscribe();
  });
});
