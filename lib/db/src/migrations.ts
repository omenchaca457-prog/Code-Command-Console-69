import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DatabaseMigration, MigrationClient } from "./migration-runner.ts";

const CORE_TABLES = [
  "conversations",
  "messages",
  "snippets",
  "agents",
  "prompts",
  "neural_events",
  "simulation_logs",
];

const CORE_SEQUENCES = [
  "conversations_id_seq",
  "messages_id_seq",
  "snippets_id_seq",
  "prompts_id_seq",
  "neural_events_id_seq",
  "simulation_logs_id_seq",
];

export type MigrationTarget = "primary" | "neon";

async function captureCoreSchemaState(
  client: MigrationClient,
): Promise<Record<string, unknown>> {
  const { rows } = await client.query(
    `SELECT jsonb_build_object(
      'tables', COALESCE((
        SELECT jsonb_agg(table_name)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($1::text[])
      ), '[]'::jsonb),
      'columns', COALESCE((
        SELECT jsonb_agg(table_name || '.' || column_name)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
      ), '[]'::jsonb),
      'constraints', COALESCE((
        SELECT jsonb_agg(t.relname || ':' || c.conname)
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = ANY($1::text[])
      ), '[]'::jsonb),
      'indexes', COALESCE((
        SELECT jsonb_agg(i.relname)
        FROM pg_index x
        JOIN pg_class t ON t.oid = x.indrelid
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = ANY($1::text[])
      ), '[]'::jsonb),
      'sequences', COALESCE((
        SELECT jsonb_agg(c.relname)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'S'
          AND c.relname = ANY($2::text[])
      ), '[]'::jsonb),
      'sequence_ownership', COALESCE((
        SELECT jsonb_agg(
          s.relname || ':' ||
          CASE
            WHEN d.objid IS NULL THEN 'NONE'
            ELSE owner_table.relname || '.' || owner_column.attname
          END
        )
        FROM pg_class s
        JOIN pg_namespace sn ON sn.oid = s.relnamespace
        LEFT JOIN pg_depend d
          ON d.classid = 'pg_class'::regclass
         AND d.objid = s.oid
         AND d.deptype IN ('a', 'i')
        LEFT JOIN pg_class owner_table ON owner_table.oid = d.refobjid
        LEFT JOIN pg_attribute owner_column
          ON owner_column.attrelid = d.refobjid
         AND owner_column.attnum = d.refobjsubid
        WHERE sn.nspname = 'public'
          AND s.relkind = 'S'
          AND s.relname = ANY($2::text[])
      ), '[]'::jsonb),
      'triggers', COALESCE((
        SELECT jsonb_agg(t.relname || ':' || g.tgname)
        FROM pg_trigger g
        JOIN pg_class t ON t.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = ANY($1::text[])
          AND NOT g.tgisinternal
      ), '[]'::jsonb),
      'functions', COALESCE((
        SELECT jsonb_agg(p.proname)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'ccc_core_persistence_set_updated_at_0001'
      ), '[]'::jsonb),
      'defaults', COALESCE((
        SELECT jsonb_agg(t.relname || '.' || a.attname)
        FROM pg_attrdef d
        JOIN pg_class t ON t.oid = d.adrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.adnum
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = ANY($1::text[])
          AND a.attname = ANY(ARRAY['id', 'updated_at']::text[])
      ), '[]'::jsonb)
    ) AS metadata`,
    [CORE_TABLES, CORE_SEQUENCES],
  );
  return (rows[0]?.metadata as Record<string, unknown> | undefined) ?? {};
}

async function captureNamedObjects(
  client: MigrationClient,
  tables: string[],
  indexes: string[],
  triggers: string[],
  functions: string[],
): Promise<Record<string, unknown>> {
  const { rows } = await client.query(
    `SELECT jsonb_build_object(
      'tables', COALESCE((
        SELECT jsonb_agg(table_name)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($1::text[])
      ), '[]'::jsonb),
      'indexes', COALESCE((
        SELECT jsonb_agg(indexname)
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ANY($2::text[])
      ), '[]'::jsonb),
      'triggers', COALESCE((
        SELECT jsonb_agg(t.relname || ':' || g.tgname)
        FROM pg_trigger g
        JOIN pg_class t ON t.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = ANY($1::text[])
          AND g.tgname = ANY($3::text[])
          AND NOT g.tgisinternal
      ), '[]'::jsonb),
      'functions', COALESCE((
        SELECT jsonb_agg(p.proname)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY($4::text[])
      ), '[]'::jsonb)
    ) AS metadata`,
    [tables, indexes, triggers, functions],
  );
  return (rows[0]?.metadata as Record<string, unknown> | undefined) ?? {};
}

async function capturePrimaryReplicationState(
  client: MigrationClient,
): Promise<Record<string, unknown>> {
  return captureNamedObjects(
    client,
    ["replication_control", "replication_outbox"],
    ["replication_outbox_pending_idx", "replication_outbox_failed_idx"],
    [
      "conversations_replication_outbox_trg",
      "agents_replication_outbox_trg",
      "messages_replication_outbox_trg",
      "prompts_replication_outbox_trg",
      "snippets_replication_outbox_trg",
      "neural_events_replication_outbox_trg",
      "simulation_logs_replication_outbox_trg",
      "conversations_replication_truncate_guard_trg",
      "agents_replication_truncate_guard_trg",
      "messages_replication_truncate_guard_trg",
      "prompts_replication_truncate_guard_trg",
      "snippets_replication_truncate_guard_trg",
      "neural_events_replication_truncate_guard_trg",
      "simulation_logs_replication_truncate_guard_trg",
    ],
    ["ccc_capture_replication_event", "ccc_guard_replication_truncate"],
  );
}

async function captureNeonReplicationState(
  client: MigrationClient,
): Promise<Record<string, unknown>> {
  return captureNamedObjects(
    client,
    [
      "replica_applied_events",
      "replica_tombstones",
      "replica_bootstrap_state",
      "replica_state",
    ],
    ["replica_applied_events_applied_at_idx"],
    [],
    [],
  );
}

async function readMigrationPair(
  id: string,
  upFilename: string,
  downFilename: string,
  captureRollbackMetadata?: DatabaseMigration["captureRollbackMetadata"],
): Promise<DatabaseMigration> {
  const directory = new URL("../migrations/", import.meta.url);
  const up = await readFile(
    fileURLToPath(new URL(upFilename, directory)),
    "utf8",
  );
  const down = await readFile(
    fileURLToPath(new URL(downFilename, directory)),
    "utf8",
  );
  return { id, up, down, captureRollbackMetadata };
}

export async function loadMigrations(target: MigrationTarget): Promise<DatabaseMigration[]> {
  const core = await readMigrationPair(
    "0001_core_persistence",
    "0001_core_persistence.up.sql",
    "0001_core_persistence.down.sql",
    captureCoreSchemaState,
  );
  const replication = target === "primary"
    ? await readMigrationPair(
        "0002_primary_replication_outbox",
        "0002_primary_replication_outbox.up.sql",
        "0002_primary_replication_outbox.down.sql",
        capturePrimaryReplicationState,
      )
    : await readMigrationPair(
        "0002_neon_replica_metadata",
        "0002_neon_replica_metadata.up.sql",
        "0002_neon_replica_metadata.down.sql",
        captureNeonReplicationState,
      );
  return [core, replication];
}
