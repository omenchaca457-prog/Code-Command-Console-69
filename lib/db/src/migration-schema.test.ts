import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationDirectory = new URL("../migrations/", import.meta.url);

describe("core persistence migration", () => {
  it("reconciles all seven Drizzle tables with the backup-compatible core columns", async () => {
    const up = await readFile(
      fileURLToPath(new URL("0001_core_persistence.up.sql", migrationDirectory)),
      "utf8",
    );
    for (const table of [
      "conversations", "messages", "snippets", "agents", "prompts",
      "neural_events", "simulation_logs",
    ]) {
      assert.match(up, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    }
    for (const column of [
      "conversation_id", "idempotency_key", "last_run_at", "updated_at",
      "successful_tasks", "failed_tasks",
    ]) {
      assert.match(up, new RegExp(column));
    }
    assert.match(up, /FOREIGN KEY \(conversation_id\) REFERENCES public\.conversations\(id\)/);
    assert.match(up, /ON DELETE CASCADE/);
    assert.match(up, /CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_key_unique/);
    assert.match(up, /CREATE TRIGGER ccc_core_persistence_snippets_updated_at_0001/);
    assert.match(up, /CREATE TRIGGER ccc_core_persistence_agents_updated_at_0001/);
    assert.doesNotMatch(up, /\b(DROP TABLE|TRUNCATE)\b/i);
  });

  it("ships a guarded down path that refuses to drop populated migration-created tables", async () => {
    const down = await readFile(
      fileURLToPath(new URL("0001_core_persistence.down.sql", migrationDirectory)),
      "utf8",
    );
    assert.match(down, /Rollback refused/);
    assert.match(down, /metadata->'tables'/);
  });
});
