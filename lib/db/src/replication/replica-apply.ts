import type { Pool, PoolClient } from "pg";
import { assertReplicaPayloadSafe } from "./replication-safety.ts";
import {
  getReplicatedTable,
  type ReplicationEvent,
} from "./replicated-tables.ts";

type ReplicaPool = Pick<Pool, "connect">;
type ReplicaClient = Pick<PoolClient, "query" | "release">;

export async function upsertReplicatedRow(
  client: Pick<PoolClient, "query">,
  tableName: string,
  row: Record<string, unknown>,
): Promise<void> {
  const table = getReplicatedTable(tableName);
  if (!table) throw new Error("Unsupported replica table.");
  assertReplicaPayloadSafe(row);

  const columns = table.columns.filter((column) => Object.hasOwn(row, column));
  if (!columns.includes("id")) throw new Error("Replica row has no stable ID.");
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  await client.query(
    `INSERT INTO public.${table.name} (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}`,
    values,
  );
  await client.query(
    `DELETE FROM public.replica_tombstones
     WHERE table_name = $1 AND record_key = $2`,
    [table.name, String(row.id)],
  );
}

export async function applyReplicationEvent(
  pool: ReplicaPool,
  event: ReplicationEvent,
): Promise<{ duplicate: boolean }> {
  const table = getReplicatedTable(event.table_name);
  if (!table) throw new Error("Unsupported replica event table.");
  if (!event.event_id || !event.record_key || !event.payload) {
    throw new Error("Replica event is incomplete.");
  }
  assertReplicaPayloadSafe(event.payload);

  const client = await pool.connect() as ReplicaClient;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ccc_replication_apply = '1'");
    const inserted = await client.query(
      `INSERT INTO public.replica_applied_events (event_id, table_name, record_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.event_id, event.table_name, event.record_key],
    );
    if (!inserted.rows.length) {
      await client.query(
        `INSERT INTO public.replica_state
          (singleton, initialized, last_event_id, last_success_at, updated_at)
         VALUES (true, true, $1, now(), now())
         ON CONFLICT (singleton) DO UPDATE SET
           last_event_id = GREATEST(COALESCE(replica_state.last_event_id, 0), EXCLUDED.last_event_id),
           last_success_at = now(),
           updated_at = now()`,
        [String(event.id)],
      );
      await client.query("COMMIT");
      return { duplicate: true };
    }

    if (event.operation === "delete") {
      await client.query(
        `DELETE FROM public.${table.name} WHERE id = $1`,
        [event.record_key],
      );
      await client.query(
        `INSERT INTO public.replica_tombstones
          (table_name, record_key, event_id, deleted_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (table_name, record_key) DO UPDATE SET
           event_id = EXCLUDED.event_id,
           deleted_at = EXCLUDED.deleted_at`,
        [event.table_name, event.record_key, event.event_id],
      );
    } else {
      await upsertReplicatedRow(client, event.table_name, event.payload);
    }

    await client.query(
      `INSERT INTO public.replica_state
        (singleton, initialized, last_event_id, last_success_at, updated_at)
       VALUES (true, true, $1, now(), now())
       ON CONFLICT (singleton) DO UPDATE SET
         last_event_id = GREATEST(COALESCE(replica_state.last_event_id, 0), EXCLUDED.last_event_id),
         last_success_at = now(),
         updated_at = now()`,
      [String(event.id)],
    );
    await client.query("COMMIT");
    return { duplicate: false };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error without logging row contents.
    }
    throw error;
  } finally {
    client.release();
  }
}
