import { Router } from "express";
import { asc, desc, gt } from "drizzle-orm";
import { db, neuralEventsTable } from "@workspace/db";
import { CreateNeuralEventBody } from "@workspace/api-zod";
import { publishNeuralEvent } from "./neural-event-bus";
import { neuralEventHub } from "./neural-event-hub";

const router = Router();

function parseEventId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

router.get("/neural-events/stream", async (req, res): Promise<void> => {
  const lastEventId = parseEventId(req.get("Last-Event-ID") ?? undefined);
  const initialCursor = parseEventId(
    typeof req.query.after === "string" ? req.query.after : undefined,
  );
  const afterId = lastEventId ?? initialCursor ?? 0;

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const subscription = neuralEventHub.subscribe(
    afterId,
    async (cursor) => db
      .select()
      .from(neuralEventsTable)
      .where(gt(neuralEventsTable.id, cursor))
      .orderBy(asc(neuralEventsTable.id)),
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

router.get("/neural-events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(neuralEventsTable)
    .orderBy(desc(neuralEventsTable.createdAt))
    .limit(50);
  res.json(events);
});

router.post("/neural-events", async (req, res): Promise<void> => {
  const parsed = CreateNeuralEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Evento neuronal inválido." });
    return;
  }

  const [created] = await db
    .insert(neuralEventsTable)
    .values(parsed.data)
    .returning();
  publishNeuralEvent({
    id: created.id,
    origin: created.origin as "terminal" | "runner" | "agents",
    eventType: created.eventType,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
  });
  res.status(201).json(created);
});

export default router;
