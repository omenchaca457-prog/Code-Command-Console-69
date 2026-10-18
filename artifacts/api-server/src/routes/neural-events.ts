import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, neuralEventsTable } from "@workspace/db";
import { CreateNeuralEventBody } from "@workspace/api-zod";
import { publishNeuralEvent, subscribeNeuralEvents } from "./neural-event-bus";

const router = Router();

router.get("/neural-events/stream", async (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": conexión establecida\n\n");

  const unsubscribe = subscribeNeuralEvents((event) => {
    if (!res.writableEnded) {
      res.write(`event: neural-event\ndata: ${JSON.stringify(event)}\n\n`);
    }
  });
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, 25_000);
  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  res.on("close", cleanup);

  try {
    const events = await db
      .select()
      .from(neuralEventsTable)
      .orderBy(desc(neuralEventsTable.createdAt))
      .limit(50);
    if (!res.writableEnded) {
      res.write(`event: snapshot\ndata: ${JSON.stringify(events)}\n\n`);
    }
  } catch (error) {
    req.log.error({ err: error }, "No se pudo enviar la instantánea neuronal");
    cleanup();
    if (!res.writableEnded) res.end();
  }
});

router.get("/neural-events", async (_req, res) => {
  const events = await db
    .select()
    .from(neuralEventsTable)
    .orderBy(desc(neuralEventsTable.createdAt))
    .limit(50);
  res.json(events);
});

router.post("/neural-events", async (req, res) => {
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
