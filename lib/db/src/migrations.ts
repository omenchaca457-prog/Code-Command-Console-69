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

export async function loadMigrations(): Promise<DatabaseMigration[]> {
  const directory = new URL("../migrations/", import.meta.url);
  const up = await readFile(
    fileURLToPath(new URL("0001_core_persistence.up.sql", directory)),
    "utf8",
  );
  const down = await readFile(
    fileURLToPath(new URL("0001_core_persistence.down.sql", directory)),
    "utf8",
  );

  return [{
    id: "0001_core_persistence",
    up,
    down,
    captureRollbackMetadata: captureCoreSchemaState,
  }];
}
