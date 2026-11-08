import { Router, type IRouter } from "express";
import { SaveTerminalMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();
const TERMINAL_SESSION_ID = "terminal_main_session";

function isTerminalSession(value: unknown): value is typeof TERMINAL_SESSION_ID {
  return value === TERMINAL_SESSION_ID;
}

router.get("/messages", async (req, res): Promise<void> => {
  if (!isTerminalSession(req.query.conversation_id)) {
    res.status(400).json({ error: "conversation_id inválido." });
    return;
  }
  try {
    const { corePersistence } = await import("@workspace/db");
    const messages = await corePersistence.listTerminalMessages();
    res.json(messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
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
    const { corePersistence } = await import("@workspace/db");
    const message = await corePersistence.createTerminalMessage(
      parsed.data.role,
      parsed.data.content,
    );
    res.status(201).json({
      ...message,
      createdAt: message.createdAt.toISOString(),
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
    const { corePersistence } = await import("@workspace/db");
    const deletedCount = await corePersistence.clearTerminalMessages();
    res.json({
      conversationId: TERMINAL_SESSION_ID,
      deletedCount,
    });
  } catch (error) {
    req.log.error({ err: error }, "No se pudo limpiar el historial de terminal");
    res.status(500).json({ error: "No se pudo limpiar el historial de terminal." });
  }
});

export default router;
