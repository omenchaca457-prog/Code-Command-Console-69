import { Router } from "express";
import { asc, desc, gt } from "drizzle-orm";
import { db, neuralEventsTable } from "@workspace/db";
import { CreateNeuralEventBody } from "@workspace/api-zod";
import { publishNeuralEvent } from "./neural-event-bus";
import { neuralEventHub } from "./neural-event-hub";
import { createNeuralEventsStreamRouter } from "./neural-events-stream";

const router = Router();
router.use(createNeuralEventsStreamRouter({
  hub: neuralEventHub,
  loadEventsSince: async (cursor) => db
    .select()
    .from(neuralEventsTable)
    .where(gt(neuralEventsTable.id, cursor))
    .orderBy(asc(neuralEventsTable.id)),
}));

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
  await publishNeuralEvent({
    id: created.id,
    origin: created.origin as "terminal" | "runner" | "agents" | "creator",
    eventType: created.eventType,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
  });
  res.status(201).json(created);
});

export default router;
