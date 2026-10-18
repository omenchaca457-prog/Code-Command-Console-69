import { Router, type IRouter } from "express";
import { SaveTerminalMessageBody } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const TERMINAL_SESSION_ID = "terminal_main_session";

async function getOrCreateTerminalConversationId(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      TERMINAL_SESSION_ID,
    ]);
    const found = await client.query<{ id: number }>(
      "SELECT id FROM conversations WHERE title = $1 ORDER BY id ASC LIMIT 1",
      [TERMINAL_SESSION_ID],
    );
    if (found.rows[0]) {
      await client.query("COMMIT");
      return found.rows[0].id;
    }
    const created = await client.query<{ id: number }>(
      "INSERT INTO conversations (title) VALUES ($1) RETURNING id",
      [TERMINAL_SESSION_ID],
    );
    await client.query("COMMIT");
    return created.rows[0]!.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function isTerminalSession(value: unknown): value is typeof TERMINAL_SESSION_ID {
  return value === TERMINAL_SESSION_ID;
}

router.get("/messages", async (req, res): Promise<void> => {
  if (!isTerminalSession(req.query.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const { rows } = await pool.query<{
      id: number;
      conversation_id: number;
      role: "user" | "assistant";
      content: string;
      created_at: Date;
    }>(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY id ASC`,
      [conversationId],
    );
    res.json(rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    })));
  } catch (error) {
    req.log.error({ err: error }, "No se pudo cargar el historial de terminal");
    res.status(500).json({ error: "No se pudo cargar el historial de terminal." });
  }
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SaveTerminalMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mensaje inválido.", details: parsed.error.flatten() });
    return;
  }
  if (!isTerminalSession(parsed.data.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const { rows } = await pool.query<{
      id: number;
      conversation_id: number;
      role: "user" | "assistant";
      content: string;
      created_at: Date;
    }>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, role, content, created_at`,
      [conversationId, parsed.data.role, parsed.data.content],
    );
    const row = rows[0]!;
    res.status(201).json({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    });
  } catch (error) {
    req.log.error({ err: error }, "No se pudo guardar el mensaje de terminal");
    res.status(500).json({ error: "No se pudo guardar el mensaje de terminal." });
  }
});

router.delete("/messages", async (req, res): Promise<void> => {
  if (!isTerminalSession(req.query.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const conversationId = await getOrCreateTerminalConversationId();
    const result = await pool.query(
      `DELETE FROM messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')`,
      [conversationId],
    );
    res.json({
      conversationId: TERMINAL_SESSION_ID,
      deletedCount: result.rowCount ?? 0,
    });
  } catch (error) {
    req.log.error({ err: error }, "No se pudo limpiar el historial de terminal");
    res.status(500).json({ error: "No se pudo limpiar el historial de terminal." });
  }
});

export default router;
