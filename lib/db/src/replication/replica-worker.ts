import type { Pool, PoolClient } from "pg";
import { applyReplicationEvent } from "./replica-apply.ts";
import { normalizeDatabaseErrorCode } from "./replication-safety.ts";
import type { ReplicationEvent } from "./replicated-tables.ts";

type PrimaryPool = Pick<Pool, "connect">;
type ReplicaPool = Pick<Pool, "connect">;
type PrimaryClient = Pick<PoolClient, "query" | "release">;

export const REPLICA_WORKER_LOCK = "code-command-console-replica-worker";
export const REPLICA_MAX_ATTEMPTS = 8;
export const REPLICA_MAX_BACKOFF_MS = 60_000;

export function replicationBackoffMs(attempt: number, random = Math.random): number {
  const exponential = Math.min(REPLICA_MAX_BACKOFF_MS, 1_000 * 2 ** Math.max(0, attempt - 1));
  const lower = exponential * 0.8;
  const upper = Math.min(REPLICA_MAX_BACKOFF_MS, exponential * 1.2);
  return Math.floor(lower + random() * (upper - lower));
}

export async function processNextReplicationEvent(
  primaryPool: PrimaryPool,
  neonPool: ReplicaPool,
  options: { now?: () => Date; random?: () => number } = {},
): Promise<"disabled" | "idle" | "sent" | "retry" | "failed" | "locked"> {
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const client = await primaryPool.connect() as PrimaryClient;

  try {
    await client.query("BEGIN");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
      [REPLICA_WORKER_LOCK],
    );
    if (lock.rows[0]?.acquired !== true) {
      await client.query("ROLLBACK");
      return "locked";
    }

    const control = await client.query(
      `SELECT enabled FROM public.replication_control
       WHERE singleton = true`,
    );
    if (control.rows[0]?.enabled !== true) {
      await client.query("COMMIT");
      return "disabled";
    }

    const pending = await client.query(
      `SELECT id, event_id, table_name, record_key, operation, payload, attempts
       FROM public.replication_outbox
       WHERE status = 'pending' AND next_attempt_at <= $1
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE`,
      [now()],
    );
    const event = pending.rows[0] as unknown as ReplicationEvent | undefined;
    if (!event) {
      await client.query("COMMIT");
      return "idle";
    }

    try {
      await applyReplicationEvent(neonPool, event);
      await client.query(
        `UPDATE public.replication_outbox
         SET status = 'sent', sent_at = $1, last_error_code = NULL
         WHERE id = $2`,
        [now(), event.id],
      );
      await client.query(
        `UPDATE public.replication_control
         SET pending_count = GREATEST(0, pending_count - 1),
             last_success_at = $1, last_event_id = $2,
             last_error_code = NULL, updated_at = $1
         WHERE singleton = true`,
        [now(), event.id],
      );
      await client.query("COMMIT");
      return "sent";
    } catch (error) {
      const attempts = Number(event.attempts) + 1;
      const terminal = error instanceof Error &&
        "code" in error &&
        String(error.code) === "credential_like_payload_blocked";
      const status = terminal || attempts >= REPLICA_MAX_ATTEMPTS ? "failed" : "pending";
      const delay = terminal ? 0 : replicationBackoffMs(attempts, random);
      const errorCode = normalizeDatabaseErrorCode(error);
      await client.query(
        `UPDATE public.replication_outbox
         SET attempts = $1, status = $2, next_attempt_at = $3,
             last_error_code = $4
         WHERE id = $5`,
        [
          attempts,
          status,
          new Date(now().getTime() + delay),
          errorCode,
          event.id,
        ],
      );
      await client.query(
        `UPDATE public.replication_control
         SET pending_count = GREATEST(0, pending_count - CASE WHEN $3 = 'failed' THEN 1 ELSE 0 END),
             last_error_code = $1, updated_at = $2
         WHERE singleton = true`,
        [errorCode, now(), status],
      );
      await client.query("COMMIT");
      return status === "failed" ? "failed" : "retry";
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the primary pool failure intact.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function startReplicaWorker(
  primaryPool: PrimaryPool,
  neonPool: ReplicaPool,
  options: {
    intervalMs?: number;
    onError?: (code: string) => void;
    processNext?: typeof processNextReplicationEvent;
  } = {},
) {
  const intervalMs = options.intervalMs ?? 1_000;
  const processNext = options.processNext ?? processNextReplicationEvent;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = processNext(primaryPool, neonPool)
        .then((status) => {
          const delayMs = status === "retry" || status === "failed"
            ? Math.min(intervalMs * 4, 5_000)
            : intervalMs;
          schedule(delayMs);
        })
        .catch((error: unknown) => {
          options.onError?.(normalizeDatabaseErrorCode(error));
          schedule(Math.min(intervalMs * 8, 10_000));
        })
        .finally(() => {
          running = undefined;
        });
    }, delay);
  };

  schedule(0);
  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running;
    },
  };
}
