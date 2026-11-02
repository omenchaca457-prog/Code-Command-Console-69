import { Router } from "express";

const router = Router();

router.post("/ai/auto-run", (req, res) => {
  req.log?.warn(
    { path: req.path, event: "autorun_blocked" },
    "Auto-run bloqueado: el campo consent no sustituye autenticación ni aislamiento",
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json({
    error: "Auto-run está desactivado por seguridad.",
    code: "execution_disabled",
    reason: "No hay autenticación de usuario ni un aislamiento de procesos verificado.",
  });
});

export default router;
