import { Router } from "express";
import type { CorePersistenceStore } from "@workspace/db";
import { createSnippetExecutionRouter } from "./snippet-execution.ts";
import {
  CreateSnippetBody,
  UpdateSnippetBody,
  GetSnippetParams,
  UpdateSnippetParams,
  DeleteSnippetParams,
} from "@workspace/api-zod";

export function createSnippetsRouter(
  persistence?: CorePersistenceStore,
) {
  const router = Router();
  const getPersistence = async (): Promise<CorePersistenceStore> => {
    if (persistence) return persistence;
    const dbPackage = await import("@workspace/db");
    return dbPackage.corePersistence;
  };

  router.use(createSnippetExecutionRouter(async (id) =>
    (await getPersistence()).recordSimulatedSnippetExecution(id),
  ));

  router.get("/snippets", async (_req, res) => {
    const snippets = await (await getPersistence()).listSnippets();
    res.json(snippets);
  });

  router.get("/snippets/recent", async (_req, res) => {
    const snippets = await (await getPersistence()).listRecentSnippets();
    res.json(snippets);
  });

  router.get("/snippets/:id", async (req, res) => {
    const parsed = GetSnippetParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const snippet = await (await getPersistence()).getSnippet(parsed.data.id);
    if (!snippet) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }

    res.json(snippet);
  });

  router.post("/snippets", async (req, res) => {
    const parsed = CreateSnippetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const created = await (await getPersistence()).createSnippet({
      title: parsed.data.title,
      code: parsed.data.code,
      language: parsed.data.language,
    });

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

    const updated = await (await getPersistence()).updateSnippet(
      paramsParsed.data.id,
      bodyParsed.data,
    );

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

    await (await getPersistence()).deleteSnippet(parsed.data.id);

    res.status(204).send();
  });

  return router;
}

export default createSnippetsRouter();
