export type NeuralEventRecord = {
  id: number;
  origin: string;
  eventType: string;
  content: string;
  createdAt: Date | string;
};

type EventListener = (event: NeuralEventRecord) => void;
type LoadEventsSince = (eventId: number) => Promise<NeuralEventRecord[]>;

export class NeuralEventHub {
  private readonly listeners = new Set<EventListener>();

  publish(event: NeuralEventRecord): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(
    afterId: number,
    loadEventsSince: LoadEventsSince,
    send: EventListener,
  ): { ready: Promise<void>; unsubscribe: () => void } {
    let active = true;
    let replaying = true;
    let lastSentId = afterId;
    const pending = new Map<number, NeuralEventRecord>();

    const deliver = (event: NeuralEventRecord) => {
      if (!active || event.id <= lastSentId) return;
      if (replaying) {
        pending.set(event.id, event);
        return;
      }
      lastSentId = event.id;
      send(event);
    };

    const unsubscribe = () => {
      if (!active) return;
      active = false;
      pending.clear();
      this.listeners.delete(deliver);
    };

    this.listeners.add(deliver);

    const ready = Promise.resolve()
      .then(() => loadEventsSince(afterId))
      .then((replayed) => {
        if (!active) return;

        const events = new Map<number, NeuralEventRecord>();
        for (const event of replayed) {
          if (event.id > afterId) events.set(event.id, event);
        }
        for (const event of pending.values()) {
          if (event.id > afterId) events.set(event.id, event);
        }

        for (const event of [...events.values()].sort((left, right) => left.id - right.id)) {
          if (!active) break;
          if (event.id <= lastSentId) continue;
          lastSentId = event.id;
          send(event);
        }

        pending.clear();
        replaying = false;
      })
      .catch((error: unknown) => {
        unsubscribe();
        throw error;
      });

    return { ready, unsubscribe };
  }
}

export const neuralEventHub = new NeuralEventHub();

