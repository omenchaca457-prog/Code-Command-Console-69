import { Router, type IRouter } from "express";
import {
  databaseConfigured,
  databaseConfigurationState,
  inspectReplicationStatus,
  neonConfigured,
  neonConfigurationStateValue,
  neonPool,
  pool,
} from "@workspace/db";
import type { ReplicationStatus } from "@workspace/db";

type StatusReader = () => Promise<ReplicationStatus>;

export function createReplicationStatusRouter(readStatus?: StatusReader): IRouter {
  const router: IRouter = Router();

  router.get("/replication/status", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const status = readStatus
        ? await readStatus()
        : await inspectReplicationStatus({
            primaryPool: pool,
            neonPool,
            primaryConfigured: databaseConfigured,
            neonConfigured,
            primaryConfigurationState: databaseConfigurationState === "postgres"
              ? "configured"
              : databaseConfigurationState,
            neonConfigurationState: neonConfigurationStateValue,
          });
      res.json(status);
    } catch {
      res.status(200).json({
        primary: databaseConfigurationState === "invalid"
          ? "invalid_configuration"
          : databaseConfigured ? "unavailable" : "not_configured",
        replica: neonConfigurationStateValue === "invalid"
          ? "invalid_configuration"
          : neonConfigured ? "unavailable" : "not_configured",
        replication: {
          state: "degraded",
          enabled: false,
          pending: 0,
          failed: 0,
          lagMs: null,
          lastSuccessAt: null,
          lastErrorCode: "status_unavailable",
        },
      });
    }
  });

  return router;
}

export default createReplicationStatusRouter();
