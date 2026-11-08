import { Router, type IRouter } from "express";
import type { ReplicationStatus } from "@workspace/db";

type StatusReader = () => Promise<ReplicationStatus>;

async function readDefaultReplicationStatus(): Promise<ReplicationStatus> {
  const {
    databaseConfigured,
    databaseConfigurationState,
    inspectReplicationStatus,
    neonConfigured,
    neonConfigurationStateValue,
    neonPool,
    pool,
  } = await import("@workspace/db");
  return inspectReplicationStatus({
    primaryPool: pool,
    neonPool,
    primaryConfigured: databaseConfigured,
    neonConfigured,
    primaryConfigurationState: databaseConfigurationState === "postgres"
      ? "configured"
      : databaseConfigurationState,
    neonConfigurationState: neonConfigurationStateValue,
  });
}

export function createReplicationStatusRouter(readStatus?: StatusReader): IRouter {
  const router: IRouter = Router();

  router.get("/replication/status", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const status = readStatus
        ? await readStatus()
        : await readDefaultReplicationStatus();
      res.json(status);
    } catch {
      res.status(200).json({
        primary: "unavailable",
        replica: "unavailable",
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
