import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();
router.get("/workspace/status", async (_req, res) => {
  let database = "disconnected";
  try {
    await pool.query("SELECT 1");
    database = "connected";
  } catch {
    /* Return the observed state without exposing connection details. */
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    database,
    node: process.version,
    uptime: Math.floor(process.uptime()),
    integrations: [
      {
        id: "openai",
        name: "OpenAI",
        configured: Boolean(
          process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.chatgpt ||
          process.env.openIA,
        ),
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        configured: Boolean(process.env.DEEPSEEK_API_KEY),
      },
      {
        id: "gemini",
        name: "Gemini",
        configured: Boolean(process.env.GEMINI_API_KEY || process.env.gemini),
      },
      {
        id: "storage",
        name: "App Storage",
        configured: Boolean(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID),
      },
    ],
  });
});
export default router;
