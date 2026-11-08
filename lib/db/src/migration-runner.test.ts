import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMigrations,
  migrationChecksum,
  rollbackLatestMigration,
  type DatabaseMigration,
  type MigrationClient,
} from "./migration-runner.ts";

class FakeMigrationPool {
  readonly applied = new Map<string, { checksum: string; rollback_metadata: unknown }>();
  readonly executed: string[] = [];
  released = 0;
  client: MigrationClient & { release: () => void };

  constructor() {
    this.client = {
      query: async (text, values = []) => {
        const sql = text.trim();
        this.executed.push(sql);
        if (sql.startsWith("SELECT checksum FROM public.schema_migrations")) {
          const record = this.applied.get(String(values[0]));
          return { rows: record ? [{ checksum: record.checksum }] : [] };
        }
        if (sql.startsWith("INSERT INTO public.schema_migrations")) {
          this.applied.set(String(values[0]), {
            checksum: String(values[1]),
            rollback_metadata: JSON.parse(String(values[2])),
          });
          return { rows: [] };
        }
        if (sql.startsWith("SELECT id, checksum, rollback_metadata")) {
          const [id, record] = [...this.applied.entries()].at(-1) ?? [];
          return {
            rows: id && record
              ? [{ id, checksum: record.checksum, rollback_metadata: record.rollback_metadata }]
              : [],
          };
        }
        if (sql.startsWith("DELETE FROM public.schema_migrations")) {
          this.applied.delete(String(values[0]));
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {
        this.released += 1;
      },
    };
  }

  async connect() {
    return this.client;
  }
}

const migration: DatabaseMigration = {
  id: "0001_test",
  up: "SELECT 'safe up'",
  down: "SELECT 'safe down'",
  captureRollbackMetadata: async () => ({ tables: ["conversations"] }),
};

describe("migration tracking", () => {
  it("applies once, records a checksum, and skips an unchanged migration", async () => {
    const pool = new FakeMigrationPool();
    assert.deepEqual(await applyMigrations(pool, [migration]), ["0001_test"]);
    assert.deepEqual(await applyMigrations(pool, [migration]), []);
    assert.equal(pool.applied.get(migration.id)?.checksum, migrationChecksum(migration));
    assert.equal(pool.executed.filter((sql) => sql === migration.up).length, 1);
    assert.equal(pool.released, 2);
  });

  it("rejects edited migration contents after application", async () => {
    const pool = new FakeMigrationPool();
    await applyMigrations(pool, [migration]);
    await assert.rejects(
      applyMigrations(pool, [{ ...migration, up: "SELECT 'changed'" }]),
      /changed after it was applied/,
    );
  });

  it("rolls back the latest migration transactionally and clears its tracking row", async () => {
    const pool = new FakeMigrationPool();
    await applyMigrations(pool, [migration]);
    assert.equal(await rollbackLatestMigration(pool, [migration]), migration.id);
    assert.equal(pool.applied.has(migration.id), false);
    assert.equal(pool.executed.includes(migration.down), true);
    assert.ok(pool.executed.includes("ROLLBACK") === false);
  });
});
