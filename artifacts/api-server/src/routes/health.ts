import { Router, type IRouter } from "express";

type DatabaseCheck = () => Promise<void>;

export function createHealthRouter(
  checkDatabase: DatabaseCheck = async () => {
    const { pool } = await import("@workspace/db");
    await pool.query("SELECT 1");
  },
): IRouter {
  const router: IRouter = Router();

  // Liveness stays independent of PostgreSQL so a database restart does not
  // cause the API process to be restarted by its liveness probe.
  router.get("/healthz", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
  });

  router.get("/readyz", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
      req.log?.warn({ code }, "PostgreSQL readiness probe failed");
      res.status(503).json({ status: "not_ready" });
    }
  });

  router.get("/replica-readyz", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { neonConfigurationStateValue, neonConfigured, neonPool } = await import("@workspace/db");
    if (!neonConfigured || !neonPool) {
      res.status(503).json({
        status: neonConfigurationStateValue === "invalid" ? "invalid_configuration" : "not_configured",
      });
      return;
    }
    try {
      await neonPool.query("SELECT 1");
      res.json({ status: "ready" });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
      req.log?.warn({ code }, "Neon replica readiness probe failed");
      res.status(503).json({ status: "not_ready" });
    }
  });

  return router;
}

export default createHealthRouter();
