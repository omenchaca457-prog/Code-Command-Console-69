import type { Pool } from "pg";

type QueryPool = Pick<Pool, "query">;

export type PoolStatus = "ready" | "unavailable" | "not_configured" | "invalid_configuration";
export type ReplicaStatus =
  | "ready"
  | "not_initialized"
  | "unavailable"
  | "not_configured"
  | "invalid_configuration";

export type ReplicationStatus = {
  primary: PoolStatus;
  replica: ReplicaStatus;
  replication: {
    state: "active" | "disabled" | "uninitialized" | "degraded" | "migration_pending" | "rebaseline_required";
    enabled: boolean;
    pending: number;
    failed: number;
    lagMs: number | null;
    lastSuccessAt: string | null;
    lastErrorCode: string | null;
  };
};

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return String(error.code);
}

export async function inspectReplicationStatus(options: {
  primaryPool: QueryPool;
  neonPool: QueryPool | null;
  primaryConfigured: boolean;
  neonConfigured: boolean;
  primaryConfigurationState?: "configured" | "missing" | "invalid";
  neonConfigurationState?: "configured" | "missing" | "invalid";
  now?: () => number;
}): Promise<ReplicationStatus> {
  const now = options.now ?? Date.now;
  const primaryState = options.primaryConfigurationState ??
    (options.primaryConfigured ? "configured" : "missing");
  const neonState = options.neonConfigurationState ??
    (options.neonConfigured ? "configured" : "missing");
  let primary: PoolStatus = primaryState === "invalid"
    ? "invalid_configuration"
    : options.primaryConfigured ? "unavailable" : "not_configured";
  let replica: ReplicaStatus = neonState === "invalid"
    ? "invalid_configuration"
    : options.neonConfigured ? "unavailable" : "not_configured";
  let state: ReplicationStatus["replication"]["state"] = options.neonConfigured
    ? "migration_pending"
    : "uninitialized";
  let enabled = false;
  let pending = 0;
  let failed = 0;
  let lagMs: number | null = null;
  let lastSuccessAt: string | null = null;
  let lastErrorCode: string | null = null;

  if (options.primaryConfigured && primaryState === "configured") {
    try {
      await options.primaryPool.query("SELECT 1");
      primary = "ready";
      const control = await options.primaryPool.query(
        `SELECT enabled, initialized_at, last_success_at, last_event_id,
                needs_rebaseline, last_error_code
         FROM public.replication_control WHERE singleton = true`,
      );
      const row = control.rows[0];
      if (!row) {
        state = "migration_pending";
      } else {
        enabled = row.enabled === true;
        lastErrorCode = typeof row.last_error_code === "string"
          ? /^[A-Za-z0-9_-]{1,64}$/.test(row.last_error_code)
            ? row.last_error_code
            : "replica_error"
          : null;
        lastSuccessAt = row.last_success_at
          ? new Date(row.last_success_at as string | Date).toISOString()
          : null;
        const counts = await options.primaryPool.query(
          `SELECT
             count(*) FILTER (WHERE status = 'pending')::int AS pending,
             count(*) FILTER (WHERE status = 'failed')::int AS failed,
             min(created_at) FILTER (WHERE status = 'pending') AS oldest_pending
           FROM public.replication_outbox`,
        );
        pending = Number(counts.rows[0]?.pending ?? 0);
        failed = Number(counts.rows[0]?.failed ?? 0);
        const oldestPending = counts.rows[0]?.oldest_pending;
        if (oldestPending) {
          lagMs = Math.max(0, now() - new Date(oldestPending as string | Date).getTime());
        }
        state = row.needs_rebaseline === true
          ? "rebaseline_required"
          : enabled ? (failed > 0 ? "degraded" : "active") : "disabled";
      }
    } catch (error) {
      if (errorCode(error) === "42P01") {
        primary = "ready";
        state = "migration_pending";
      } else {
        primary = "unavailable";
      }
    }
  }

  if (options.neonConfigured && neonState === "configured" && options.neonPool) {
    try {
      await options.neonPool.query("SELECT 1");
      const status = await options.neonPool.query(
        `SELECT initialized, last_event_id, last_success_at
         FROM public.replica_state WHERE singleton = true`,
      );
      const replicaRow = status.rows[0];
      replica = replicaRow?.initialized === true ? "ready" : "not_initialized";
      if (!replicaRow) state = state === "disabled" ? "uninitialized" : state;
      if (replicaRow?.last_success_at && !lastSuccessAt) {
        lastSuccessAt = new Date(replicaRow.last_success_at as string | Date).toISOString();
      }
      if (replicaRow?.initialized === false && enabled) state = "uninitialized";
      if (replica === "not_initialized" && state === "active") state = "degraded";
      if (replica === "ready" && pending === 0 && failed === 0) lagMs = 0;
    } catch (error) {
      replica = errorCode(error) === "42P01" ? "not_initialized" : "unavailable";
      if (replica === "unavailable" && enabled) state = "degraded";
    }
  }

  return {
    primary,
    replica,
    replication: {
      state,
      enabled,
      pending,
      failed,
      lagMs,
      lastSuccessAt,
      lastErrorCode,
    },
  };
}
