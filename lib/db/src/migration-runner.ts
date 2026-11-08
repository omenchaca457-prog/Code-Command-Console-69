import { createHash } from "node:crypto";

export type MigrationClient = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type MigrationPool = {
  connect(): Promise<MigrationClient & { release(): void }>;
};

export type DatabaseMigration = {
  id: string;
  up: string;
  down: string;
  captureRollbackMetadata?: (client: MigrationClient) => Promise<Record<string, unknown>>;
};

const MIGRATION_LOCK_KEY = "code-command-console-schema-migrations";

export function migrationChecksum(migration: DatabaseMigration): string {
  return createHash("sha256")
    .update(migration.up)
    .update("\0")
    .update(migration.down)
    .digest("hex");
}

async function beginMigrationSession(pool: MigrationPool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      MIGRATION_LOCK_KEY,
    ]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        rollback_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    return client;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original error.
    }
    client.release();
    throw error;
  }
}

export async function applyMigrations(
  pool: MigrationPool,
  migrations: DatabaseMigration[],
): Promise<string[]> {
  const client = await beginMigrationSession(pool);
  const applied: string[] = [];

  try {
    for (const migration of [...migrations].sort((left, right) => left.id.localeCompare(right.id))) {
      const checksum = migrationChecksum(migration);
      const existing = await client.query(
        "SELECT checksum FROM public.schema_migrations WHERE id = $1",
        [migration.id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${migration.id} changed after it was applied.`);
        }
        continue;
      }

      const metadata = await migration.captureRollbackMetadata?.(client) ?? {};
      await client.query(migration.up);
      await client.query(
        `INSERT INTO public.schema_migrations (id, checksum, rollback_metadata)
         VALUES ($1, $2, $3::jsonb)`,
        [migration.id, checksum, JSON.stringify(metadata)],
      );
      applied.push(migration.id);
    }

    await client.query("COMMIT");
    return applied;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackLatestMigration(
  pool: MigrationPool,
  migrations: DatabaseMigration[],
): Promise<string | null> {
  const client = await beginMigrationSession(pool);

  try {
    const result = await client.query(
      `SELECT id, checksum, rollback_metadata
       FROM public.schema_migrations
       ORDER BY applied_at DESC, id DESC
       LIMIT 1`,
    );
    const record = result.rows[0];
    if (!record) {
      await client.query("COMMIT");
      return null;
    }

    const migration = migrations.find((item) => item.id === record.id);
    if (!migration) {
      throw new Error(`No rollback definition exists for migration ${String(record.id)}.`);
    }
    if (record.checksum !== migrationChecksum(migration)) {
      throw new Error(`Migration ${migration.id} changed after it was applied.`);
    }

    const metadata =
      typeof record.rollback_metadata === "string"
        ? record.rollback_metadata
        : JSON.stringify(record.rollback_metadata ?? {});
    await client.query(
      "SELECT set_config('ccc.rollback_metadata', $1, true)",
      [metadata],
    );
    await client.query(migration.down);
    await client.query(
      "DELETE FROM public.schema_migrations WHERE id = $1",
      [migration.id],
    );
    await client.query("COMMIT");
    return migration.id;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}
