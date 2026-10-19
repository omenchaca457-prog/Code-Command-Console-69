import { EventEmitter } from "node:events";
import { neuralEventHub } from "./neural-event-hub.ts";

export type StreamedNeuralEvent = {
  id: number;
  origin: "terminal" | "runner" | "agents" | "creator";
  eventType: string;
  content: string;
  createdAt: string;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);
let notifyOtherInstances: ((eventId: number) => Promise<void>) | undefined;

function deliverNeuralEvent(event: StreamedNeuralEvent) {
  neuralEventHub.publish(event);
  emitter.emit("event", event);
}

export function configureNeuralEventNotifier(
  notify: (eventId: number) => Promise<void>,
) {
  notifyOtherInstances = notify;
}

export function publishRemoteNeuralEvent(event: StreamedNeuralEvent) {
  deliverNeuralEvent(event);
}

export async function publishNeuralEvent(event: StreamedNeuralEvent) {
  deliverNeuralEvent(event);
  await notifyOtherInstances?.(event.id);
}

export function subscribeNeuralEvents(listener: (event: StreamedNeuralEvent) => void) {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
