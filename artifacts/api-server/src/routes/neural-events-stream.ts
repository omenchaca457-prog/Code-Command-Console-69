import { Router } from "express";
import { neuralEventHub, type NeuralEventHub, type NeuralEventRecord } from "./neural-event-hub.ts";

type LoadEventsSince = (eventId: number) => Promise<NeuralEventRecord[]>;

type NeuralEventsStreamDependencies = {
  loadEventsSince: LoadEventsSince;
  hub?: NeuralEventHub;
};

function parseEventId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

export function createNeuralEventsStreamRouter({
  loadEventsSince,
  hub = neuralEventHub,
}: NeuralEventsStreamDependencies) {
  const router = Router();

  router.get("/neural-events/stream", async (req, res): Promise<void> => {
    const lastEventId = parseEventId(req.get("Last-Event-ID") ?? undefined);
    const initialCursor = parseEventId(
      typeof req.query.after === "string" ? req.query.after : undefined,
    );
    const afterId = lastEventId ?? initialCursor ?? 0;

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const subscription = hub.subscribe(
      afterId,
      loadEventsSince,
      (event) => {
        if (res.destroyed || res.writableEnded) return;
        res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      },
    );
    const heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(": keep-alive\n\n");
    }, 25_000);

    res.once("close", () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });

    try {
      await subscription.ready;
    } catch (error) {
      req.log.error({ err: error, afterId }, "No se pudo recuperar la actividad neuronal para SSE");
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  });

  return router;
}
