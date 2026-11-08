import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { Pool, PoolClient } from "pg";
import {
  databaseConfigured,
  neonConfigured,
  neonPool,
  pool,
} from "./index.ts";
import { assertReplicaPayloadSafe } from "./replication/replication-safety.ts";
import { REPLICATED_TABLES } from "./replication/replicated-tables.ts";
import { upsertReplicatedRow } from "./replication/replica-apply.ts";
import {
  classifyReplicaBootstrap,
  replicaDigestsMatch,
  type ReplicaTableDigest,
} from "./replication/bootstrap-policy.ts";

const PAGE_SIZE = 500;
const MAX_ROWS_PER_TABLE = 1_000_000;
const TABLE_NAMES = REPLICATED_TABLES.map((table) => `public.${table.name}`).join(", ");

type AdminPool = Pick<Pool, "connect">;
type AdminClient = Pick<PoolClient, "query" | "release">;
type TableDigest = ReplicaTableDigest;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function readSchemaFingerprint(
  client: Pick<PoolClient, "query">,
): Promise<string> {
  const { rows } = await client.query(
    `SELECT jsonb_build_object(
      'columns', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'table', table_name,
          'column', column_name,
          'ordinal', ordinal_position,
          'type', data_type,
          'udt', udt_name,
          'nullable', is_nullable,
          'default', column_default
        ) ORDER BY table_name, ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
      ), '[]'::jsonb),
      'constraints', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'table', c.conrelid::regclass::text,
          'name', c.conname,
          'type', c.contype,
          'definition', pg_get_constraintdef(c.oid, true)
        ) ORDER BY c.conrelid::regclass::text, c.conname)
        FROM pg_constraint c
        WHERE c.conrelid IN (
          SELECT format('public.%I', table_name)::regclass
          FROM unnest($1::text[]) AS tables(table_name)
          WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
        )
      ), '[]'::jsonb),
      'indexes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'table', tablename,
          'name', indexname,
          'definition', indexdef
        ) ORDER BY tablename, indexname)
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
      ), '[]'::jsonb)
    ) AS schema`,
    [REPLICATED_TABLES.map((table) => table.name)],
  );
  return createHash("sha256").update(canonicalJson(rows[0]?.schema ?? {})).digest("hex");
}

async function scanTable(
  client: Pick<PoolClient, "query">,
  tableName: string,
): Promise<TableDigest> {
  const table = REPLICATED_TABLES.find((item) => item.name === tableName);
  if (!table) throw new Error("Unsupported replicated table.");
  const hash = createHash("sha256");
  let cursor: unknown;
  let rows = 0;

  while (true) {
    const query = cursor === undefined
      ? `SELECT to_jsonb(t) AS row FROM public.${table.name} AS t ORDER BY id ASC LIMIT $1`
      : `SELECT to_jsonb(t) AS row FROM public.${table.name} AS t
         WHERE id > $1 ORDER BY id ASC LIMIT $2`;
    const values = cursor === undefined ? [PAGE_SIZE] : [cursor, PAGE_SIZE];
    const page = await client.query(query, values);
    if (!page.rows.length) break;

    for (const result of page.rows) {
      const row = result.row as Record<string, unknown>;
      assertReplicaPayloadSafe(row);
      hash.update(canonicalJson(row));
      hash.update("\n");
      rows += 1;
      if (rows > MAX_ROWS_PER_TABLE) {
        throw new Error("Admin comparison row limit exceeded.");
      }
      cursor = row.id;
    }
    if (page.rows.length < PAGE_SIZE) break;
  }

  return { table: table.name, rows, checksum: hash.digest("hex") };
}

async function scanAllTables(client: Pick<PoolClient, "query">): Promise<TableDigest[]> {
  const digests: TableDigest[] = [];
  for (const table of REPLICATED_TABLES) {
    digests.push(await scanTable(client, table.name));
  }
  return digests;
}

async function beginReadSnapshot(client: AdminClient): Promise<void> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
}

export async function compareReplicaData(
  primaryPool: AdminPool,
  replicaPool: AdminPool,
) {
  const primaryClient = await primaryPool.connect() as AdminClient;
  const replicaClient = await replicaPool.connect() as AdminClient;
  try {
    await beginReadSnapshot(primaryClient);
    await beginReadSnapshot(replicaClient);
    const [primarySchema, replicaSchema, primary, replica] = await Promise.all([
      readSchemaFingerprint(primaryClient),
      readSchemaFingerprint(replicaClient),
      scanAllTables(primaryClient),
      scanAllTables(replicaClient),
    ]);
    await Promise.all([primaryClient.query("COMMIT"), replicaClient.query("COMMIT")]);
    return {
      schemaMatch: primarySchema === replicaSchema,
      exactMatch: primarySchema === replicaSchema && replicaDigestsMatch(primary, replica),
      tables: primary.map((source, index) => ({
        name: source.table,
        primaryRows: source.rows,
        replicaRows: replica[index]?.rows ?? 0,
        checksumsMatch: source.checksum === replica[index]?.checksum,
      })),
    };
  } catch (error) {
    await Promise.allSettled([
      primaryClient.query("ROLLBACK"),
      replicaClient.query("ROLLBACK"),
    ]);
    throw error;
  } finally {
    primaryClient.release();
    replicaClient.release();
  }
}

async function assertMigrationApplied(
  client: Pick<PoolClient, "query">,
  target: "primary" | "neon",
) {
  const migrationIds = target === "primary"
    ? ["0001_core_persistence", "0002_primary_replication_outbox"]
    : ["0001_core_persistence", "0002_neon_replica_metadata"];
  const result = await client.query(
    `SELECT id FROM public.schema_migrations WHERE id = ANY($1::text[])`,
    [migrationIds],
  );
  const applied = new Set(result.rows.map((row) => String(row.id)));
  if (migrationIds.some((id) => !applied.has(id))) {
    throw new Error(`${target} migrations are not current.`);
  }
}

async function copyPrimaryRows(
  primaryClient: AdminClient,
  neonClient: AdminClient,
): Promise<void> {
  await neonClient.query("SET LOCAL ccc_replication_apply = '1'");
  for (const table of REPLICATED_TABLES) {
    let cursor: unknown;
    while (true) {
      const query = cursor === undefined
        ? `SELECT to_jsonb(t) AS row FROM public.${table.name} AS t ORDER BY id ASC LIMIT $1`
        : `SELECT to_jsonb(t) AS row FROM public.${table.name} AS t
           WHERE id > $1 ORDER BY id ASC LIMIT $2`;
      const values = cursor === undefined ? [PAGE_SIZE] : [cursor, PAGE_SIZE];
      const page = await primaryClient.query(query, values);
      if (!page.rows.length) break;
      for (const result of page.rows) {
        const row = result.row as Record<string, unknown>;
        assertReplicaPayloadSafe(row);
        await upsertReplicatedRow(neonClient, table.name, row);
        cursor = row.id;
      }
      if (page.rows.length < PAGE_SIZE) break;
    }
    const sequence = await neonClient.query(
      "SELECT pg_get_serial_sequence($1, 'id') AS sequence",
      [`public.${table.name}`],
    );
    const sequenceName = sequence.rows[0]?.sequence;
    if (sequenceName) {
      const maxId = await neonClient.query(
        `SELECT max(id)::text AS max_id FROM public.${table.name}`,
      );
      if (maxId.rows[0]?.max_id !== null && maxId.rows[0]?.max_id !== undefined) {
        await neonClient.query(
          "SELECT setval($1::regclass, $2::bigint, true)",
          [sequenceName, String(maxId.rows[0].max_id)],
        );
      }
    }
  }
}

export async function initializeReplicaIfSafe(
  primaryPool: AdminPool,
  replicaPool: AdminPool,
): Promise<{ initialized: boolean; exactMatch: boolean }> {
  const primaryClient = await primaryPool.connect() as AdminClient;
  const replicaClient = await replicaPool.connect() as AdminClient;
  let replicaCommitted = false;
  try {
    await primaryClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await primaryClient.query("SET LOCAL TIME ZONE 'UTC'");
    await primaryClient.query(`LOCK TABLE ${TABLE_NAMES} IN SHARE MODE`);
    await replicaClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await replicaClient.query("SET LOCAL TIME ZONE 'UTC'");
    await replicaClient.query(`LOCK TABLE ${TABLE_NAMES} IN ACCESS EXCLUSIVE MODE`);

    await assertMigrationApplied(primaryClient, "primary");
    await assertMigrationApplied(replicaClient, "neon");
    const [primarySchema, replicaSchema] = await Promise.all([
      readSchemaFingerprint(primaryClient),
      readSchemaFingerprint(replicaClient),
    ]);
    if (primarySchema !== replicaSchema) {
      throw new Error("Primary and Neon schemas differ; no rows were changed.");
    }
    const control = await primaryClient.query(
      `SELECT enabled, initialized_at
       FROM public.replication_control WHERE singleton = true FOR UPDATE`,
    );
    if (!control.rows[0]) throw new Error("Primary replication control is missing.");
    if (control.rows[0].enabled === true) {
      throw new Error("Replica is already enabled; refusing to reseed it.");
    }

    const primaryDigest = await scanAllTables(primaryClient);
    const replicaDigest = await scanAllTables(replicaClient);
    const bootstrapAction = classifyReplicaBootstrap(primaryDigest, replicaDigest);
    let exactMatch = replicaDigestsMatch(primaryDigest, replicaDigest);

    if (bootstrapAction === "copy-empty-target") {
      await copyPrimaryRows(primaryClient, replicaClient);
      const verifiedReplica = await scanAllTables(replicaClient);
      exactMatch = replicaDigestsMatch(primaryDigest, verifiedReplica);
      if (!exactMatch) throw new Error("Post-copy checksum verification failed.");
    }
    if (!exactMatch) throw new Error("Replica checksum verification failed.");

    const highWater = await primaryClient.query(
      "SELECT COALESCE(max(id), 0)::text AS event_id FROM public.replication_outbox",
    );
    const baselineEventId = String(highWater.rows[0]?.event_id ?? "0");

    const existingUnsent = await primaryClient.query(
      `SELECT payload FROM public.replication_outbox
       WHERE id <= $1::bigint AND status <> 'sent'`,
      [baselineEventId],
    );
    for (const event of existingUnsent.rows) {
      assertReplicaPayloadSafe(event.payload as Record<string, unknown>);
    }

    for (const digest of primaryDigest) {
      await replicaClient.query(
        `INSERT INTO public.replica_bootstrap_state
          (table_name, row_count, checksum, source_event_id, initialized_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (table_name) DO UPDATE SET
           row_count = EXCLUDED.row_count,
           checksum = EXCLUDED.checksum,
           source_event_id = EXCLUDED.source_event_id,
           initialized_at = EXCLUDED.initialized_at`,
        [digest.table, digest.rows, digest.checksum, baselineEventId],
      );
    }
    await replicaClient.query(
      `INSERT INTO public.replica_state
        (singleton, initialized, initialized_at, last_event_id, last_success_at, updated_at)
       VALUES (true, true, now(), $1, now(), now())
       ON CONFLICT (singleton) DO UPDATE SET
         initialized = true,
         initialized_at = COALESCE(replica_state.initialized_at, now()),
         last_event_id = $1,
         last_success_at = now(),
         updated_at = now()`,
      [baselineEventId],
    );
    await replicaClient.query("COMMIT");
    replicaCommitted = true;

    await primaryClient.query(
      `UPDATE public.replication_outbox
       SET status = 'sent', sent_at = COALESCE(sent_at, now()), last_error_code = NULL
       WHERE id <= $1::bigint AND status IN ('pending', 'failed')`,
      [baselineEventId],
    );
    await primaryClient.query(
      `UPDATE public.replication_control
       SET enabled = true,
           initialized_at = COALESCE(initialized_at, now()),
           last_success_at = now(),
           last_event_id = $1,
           pending_count = 0,
           needs_rebaseline = false,
           last_error_code = NULL,
           updated_at = now()
       WHERE singleton = true`,
      [baselineEventId],
    );
    await primaryClient.query("COMMIT");
    return { initialized: true, exactMatch: true };
  } catch (error) {
    if (!replicaCommitted) {
      await Promise.allSettled([replicaClient.query("ROLLBACK")]);
    }
    await Promise.allSettled([primaryClient.query("ROLLBACK")]);
    throw error;
  } finally {
    primaryClient.release();
    replicaClient.release();
  }
}

export async function retryFailedReplicaEvents(primaryPool: AdminPool): Promise<number> {
  const client = await primaryPool.connect() as AdminClient;
  try {
    await client.query("BEGIN");
    const control = await client.query(
      `SELECT pending_count, needs_rebaseline, enabled
       FROM public.replication_control
       WHERE singleton = true FOR UPDATE`,
    );
    if (control.rows[0]?.needs_rebaseline === true) {
      throw new Error("Replication needs an explicit reconciliation before retrying failed events.");
    }
    if (control.rows[0]?.enabled !== true) {
      await client.query("COMMIT");
      return 0;
    }
    const capacity = Math.max(
      0,
      100_000 - Number(control.rows[0]?.pending_count ?? 0),
    );
    if (capacity === 0) {
      await client.query("COMMIT");
      return 0;
    }
    const result = await client.query(
      `WITH candidates AS (
         SELECT id FROM public.replication_outbox
         WHERE status = 'failed'
           AND last_error_code <> 'credential_like_payload_blocked'
         ORDER BY id LIMIT $1 FOR UPDATE
       )
       UPDATE public.replication_outbox AS event
       SET status = 'pending', attempts = 0, next_attempt_at = now(),
           last_error_code = NULL
       FROM candidates
       WHERE event.id = candidates.id
       RETURNING event.id`,
      [capacity],
    );
    await client.query(
      `UPDATE public.replication_control
       SET pending_count = pending_count + $1,
           last_error_code = NULL, updated_at = now()
       WHERE singleton = true`,
      [result.rows.length],
    );
    await client.query("COMMIT");
    return result.rows.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const command = process.argv[2];
  if (!databaseConfigured || !neonConfigured || !neonPool) {
    throw new Error("Both DATABASE_URL and NEON_DATABASE_URL must be configured.");
  }
  if (command === "dry-run") {
    const result = await compareReplicaData(pool, neonPool);
    process.stdout.write(`${JSON.stringify({ status: result.exactMatch ? "match" : "conflict", ...result }, null, 2)}\n`);
    if (!result.exactMatch) process.exitCode = 1;
    return;
  }
  if (command === "initialize") {
    if (!process.argv.includes("--confirm-safe-initialize")) {
      throw new Error("Pass --confirm-safe-initialize to allow empty-target initialization or exact-match activation.");
    }
    const result = await initializeReplicaIfSafe(pool, neonPool);
    process.stdout.write(`${JSON.stringify({ status: "verified", ...result }, null, 2)}\n`);
    return;
  }
  if (command === "retry-failed") {
    if (!process.argv.includes("--confirm-retry-failed")) {
      throw new Error("Pass --confirm-retry-failed to requeue eligible failed events.");
    }
    const count = await retryFailedReplicaEvents(pool);
    process.stdout.write(`${JSON.stringify({ status: "requeued", count }, null, 2)}\n`);
    return;
  }
  throw new Error("Usage: replica-admin.ts <dry-run|initialize|retry-failed>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .catch((error: unknown) => {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "replication_admin_blocked";
      process.stderr.write(`${JSON.stringify({ status: "blocked", code })}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await Promise.allSettled([pool.end(), neonPool?.end()]);
    });
}
