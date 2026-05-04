import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, snippetsTable } from "@workspace/db";
import {
  CreateSnippetBody,
  UpdateSnippetBody,
  GetSnippetParams,
  UpdateSnippetParams,
  DeleteSnippetParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/snippets", async (_req, res) => {
  const snippets = await db
    .select()
    .from(snippetsTable)
    .orderBy(desc(snippetsTable.updatedAt));
  res.json(snippets);
});

router.get("/snippets/recent", async (_req, res) => {
  const snippets = await db
    .select()
    .from(snippetsTable)
    .orderBy(desc(snippetsTable.updatedAt))
    .limit(5);
  res.json(snippets);
});

router.get("/snippets/:id", async (req, res) => {
  const parsed = GetSnippetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const snippet = await db
    .select()
    .from(snippetsTable)
    .where(eq(snippetsTable.id, parsed.data.id))
    .limit(1);

  if (snippet.length === 0) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }

  res.json(snippet[0]);
});

router.post("/snippets", async (req, res) => {
  const parsed = CreateSnippetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [created] = await db
    .insert(snippetsTable)
    .values({
      title: parsed.data.title,
      code: parsed.data.code,
      language: parsed.data.language,
    })
    .returning();

  res.status(201).json(created);
});

router.put("/snippets/:id", async (req, res) => {
  const paramsParsed = UpdateSnippetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateSnippetBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (bodyParsed.data.title !== undefined) updates.title = bodyParsed.data.title;
  if (bodyParsed.data.code !== undefined) updates.code = bodyParsed.data.code;
  if (bodyParsed.data.language !== undefined) updates.language = bodyParsed.data.language;

  const [updated] = await db
    .update(snippetsTable)
    .set(updates)
    .where(eq(snippetsTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Snippet not found" });
    return;
  }

  res.json(updated);
});

router.delete("/snippets/:id", async (req, res) => {
  const parsed = DeleteSnippetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(snippetsTable)
    .where(eq(snippetsTable.id, parsed.data.id));

  res.status(204).send();
});

export default router;
