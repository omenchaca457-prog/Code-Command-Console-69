import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMigrations,
  type MigrationClient,
  type MigrationPool,
} from "./migration-runner.ts";
import { loadMigrations } from "./migrations.ts";

class FakeMigrationPool implements MigrationPool {
  readonly applied = new Map<string, string>();
  readonly statements: string[] = [];
  private readonly client: MigrationClient & { release: () => void };

  constructor() {
    this.client = {
      query: async (sql, values = []) => {
        this.statements.push(sql.trim());
        if (sql.startsWith("SELECT checksum FROM public.schema_migrations")) {
          const checksum = this.applied.get(String(values[0]));
          return { rows: checksum ? [{ checksum }] : [] };
        }
        if (sql.startsWith("INSERT INTO public.schema_migrations")) {
          this.applied.set(String(values[0]), String(values[1]));
        }
        return { rows: [] };
      },
      release: () => undefined,
    };
  }

  async connect() {
    return this.client;
  }
}

describe("independent primary and Neon migrations", () => {
  it("loads the Replit outbox migration separately from Neon receiver metadata", async () => {
    const [primary, neon] = await Promise.all([
      loadMigrations("primary"),
      loadMigrations("neon"),
    ]);
    assert.deepEqual(primary.map((migration) => migration.id), [
      "0001_core_persistence",
      "0002_primary_replication_outbox",
    ]);
    assert.deepEqual(neon.map((migration) => migration.id), [
      "0001_core_persistence",
      "0002_neon_replica_metadata",
    ]);
    assert.match(primary[1]!.up, /ccc_capture_replication_event/);
    assert.match(neon[1]!.up, /replica_applied_events/);
    assert.doesNotMatch(neon[1]!.up, /replication_outbox/);
  });

  it("tracks and applies each target's migrations independently", async () => {
    const primaryPool = new FakeMigrationPool();
    const neonPool = new FakeMigrationPool();
    const [primary, neon] = await Promise.all([
      loadMigrations("primary"),
      loadMigrations("neon"),
    ]);
    assert.deepEqual(await applyMigrations(primaryPool, primary), [
      "0001_core_persistence",
      "0002_primary_replication_outbox",
    ]);
    assert.deepEqual(await applyMigrations(neonPool, neon), [
      "0001_core_persistence",
      "0002_neon_replica_metadata",
    ]);
    assert.equal(primaryPool.applied.has("0002_neon_replica_metadata"), false);
    assert.equal(neonPool.applied.has("0002_primary_replication_outbox"), false);
  });
});
