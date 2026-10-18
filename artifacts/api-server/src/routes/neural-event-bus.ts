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

export function publishNeuralEvent(event: StreamedNeuralEvent) {
  neuralEventHub.publish(event);
  emitter.emit("event", event);
}

export function subscribeNeuralEvents(listener: (event: StreamedNeuralEvent) => void) {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
