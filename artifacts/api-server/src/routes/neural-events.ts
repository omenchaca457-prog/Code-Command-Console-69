import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, neuralEventsTable } from "@workspace/db";
import { CreateNeuralEventBody } from "@workspace/api-zod";

const router = Router();

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
  res.status(201).json(created);
});

export default router;
