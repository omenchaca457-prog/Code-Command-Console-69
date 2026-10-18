import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publishNeuralEvent, subscribeNeuralEvents } from "./neural-event-bus.ts";

describe("neural event stream bus", () => {
  it("delivers events to live subscribers and stops after unsubscribe", () => {
    const received: number[] = [];
    const unsubscribe = subscribeNeuralEvents((event) => received.push(event.id));
    publishNeuralEvent({
      id: 1001,
      origin: "runner",
      eventType: "execution",
      content: "test",
      createdAt: new Date().toISOString(),
    });
    unsubscribe();
    publishNeuralEvent({
      id: 1002,
      origin: "runner",
      eventType: "execution",
      content: "test",
      createdAt: new Date().toISOString(),
    });
    assert.deepEqual(received, [1001]);
  });
});
