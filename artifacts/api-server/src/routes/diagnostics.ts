import { Router, type IRouter } from "express";
import { recordWebviewError } from "../lib/runtime-diagnostics";

const router: IRouter = Router();

router.post("/diagnostics/webview", (req, res) => {
  const { message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "El mensaje de diagnóstico es obligatorio." });
    return;
  }
  recordWebviewError(message.trim().slice(0, 500));
  res.status(202).json({ accepted: true });
});

export default router;
