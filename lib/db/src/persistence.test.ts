import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCorePersistenceStore,
  type SnippetRecord,
} from "./persistence.ts";

describe("core persistence local fallback", () => {
  it("supports snippet create/read/update/delete and simulated execution", async () => {
    const store = createCorePersistenceStore({} as never, false);
    const created = await store.createSnippet({
      title: "demo",
      code: "console.log(1)",
      language: "javascript",
    });
    assert.equal(created.id, 1);
    assert.equal(created.lastRunAt, null);
    assert.equal((await store.getSnippet(created.id))?.title, "demo");

    const updated = await store.updateSnippet(created.id, { title: "renamed" });
    assert.equal(updated?.title, "renamed");
    assert.ok(updated!.updatedAt >= created.updatedAt);

    const execution = await store.recordSimulatedSnippetExecution(created.id);
    assert.equal(execution?.simulated, true);
    assert.equal(execution?.output, "Hello, DevTerminal!");
    assert.ok(await store.getSnippet(created.id));

    assert.equal(await store.deleteSnippet(created.id), true);
    assert.equal(await store.getSnippet(created.id), null);
  });

  it("supports terminal message CRUD and keeps the fallback process-local", async () => {
    const first = createCorePersistenceStore({} as never, false);
    const message = await first.createTerminalMessage("user", "test");
    assert.deepEqual(await first.listTerminalMessages(), [message]);
    assert.equal(await first.clearTerminalMessages(), 1);
    assert.deepEqual(await first.listTerminalMessages(), []);

    const restarted = createCorePersistenceStore({} as never, false);
    assert.deepEqual(await restarted.listTerminalMessages(), []);
  });
});

describe("core persistence PostgreSQL adapter", () => {
  it("uses bound values and returns database-backed CRUD results", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const now = new Date("2026-11-08T00:00:00.000Z");
    const row: SnippetRecord = {
      id: 7,
      title: "from-db",
      code: "x",
      language: "javascript",
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
    };
    const pool = {
      async query(sql: string, values: unknown[] = []) {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT id, title, code, language, created_at, updated_at, last_run_at FROM snippets WHERE")) {
          return { rows: [{
            id: row.id,
            title: row.title,
            code: row.code,
            language: row.language,
            created_at: row.createdAt,
            updated_at: row.updatedAt,
            last_run_at: row.lastRunAt,
          }], rowCount: 1 };
        }
        if (sql.startsWith("SELECT id, title, code, language, created_at, updated_at, last_run_at FROM snippets ORDER BY")) {
          return { rows: [{
            id: row.id,
            title: row.title,
            code: row.code,
            language: row.language,
            created_at: row.createdAt,
            updated_at: row.updatedAt,
            last_run_at: row.lastRunAt,
          }], rowCount: 1 };
        }
        if (sql.startsWith("INSERT INTO snippets")) {
          return { rows: [{
            id: row.id,
            title: row.title,
            code: row.code,
            language: row.language,
            created_at: row.createdAt,
            updated_at: row.updatedAt,
            last_run_at: row.lastRunAt,
          }], rowCount: 1 };
        }
        if (sql.startsWith("UPDATE snippets")) {
          return { rows: [{
            id: row.id,
            title: "updated",
            code: row.code,
            language: row.language,
            created_at: row.createdAt,
            updated_at: now,
            last_run_at: row.lastRunAt,
          }], rowCount: 1 };
        }
        if (sql.startsWith("DELETE FROM snippets")) {
          return { rows: [], rowCount: 1 };
        }
        throw new Error("Unexpected SQL in persistence test.");
      },
      async connect() {
        throw new Error("Transaction connection not expected in this test.");
      },
    };

    const store = createCorePersistenceStore(pool as never, true);
    const created = await store.createSnippet({
      title: "from-db",
      code: "x",
      language: "javascript",
    });
    assert.equal(created.id, 7);
    assert.equal((await store.listSnippets()).length, 1);
    assert.equal((await store.listRecentSnippets()).length, 1);
    assert.equal((await store.getSnippet(7))?.id, 7);
    assert.deepEqual(calls[0]?.values, ["from-db", "x", "javascript"]);
    const insertCall = calls.find((call) => call.sql.startsWith("INSERT INTO snippets"))!;
    assert.match(insertCall.sql, /VALUES \(\$1, \$2, \$3\)/);
    assert.deepEqual(insertCall.values, ["from-db", "x", "javascript"]);

    const updated = await store.updateSnippet(7, { title: "updated" });
    assert.equal(updated?.title, "updated");
    const updateCall = calls.find((call) => call.sql.startsWith("UPDATE snippets"))!;
    assert.deepEqual(updateCall.values, [7, "updated"]);
    assert.equal(await store.deleteSnippet(7), true);
    const deleteCall = calls.find((call) => call.sql.startsWith("DELETE FROM snippets"))!;
    assert.deepEqual(deleteCall.values, [7]);
  });

  it("persists terminal conversations and message CRUD through parameterized PostgreSQL calls", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const savedAt = new Date("2026-11-08T02:00:00.000Z");
    const transactionClient = {
      async query(sql: string, values: unknown[] = []) {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT id FROM conversations")) {
          return { rows: [{ id: 12 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release() {},
    };
    const pool = {
      async connect() {
        return transactionClient;
      },
      async query(sql: string, values: unknown[] = []) {
        calls.push({ sql, values });
        if (sql.startsWith("INSERT INTO messages")) {
          return {
            rows: [{
              id: 3,
              conversation_id: 12,
              role: "user",
              content: "persisted",
              created_at: savedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.startsWith("SELECT id, conversation_id, role, content, created_at")) {
          return {
            rows: [{
              id: 3,
              conversation_id: 12,
              role: "user",
              content: "persisted",
              created_at: savedAt,
            }],
            rowCount: 1,
          };
        }
        if (sql.startsWith("DELETE FROM messages")) {
          return { rows: [], rowCount: 1 };
        }
        throw new Error("Unexpected SQL in terminal persistence test.");
      },
    };
    const store = createCorePersistenceStore(pool as never, true);

    const created = await store.createTerminalMessage("user", "persisted");
    assert.equal(created.conversationId, 12);
    assert.equal((await store.listTerminalMessages())[0]?.content, "persisted");
    assert.equal(await store.clearTerminalMessages(), 1);
    assert.ok(calls.some((call) => call.sql.includes("pg_advisory_xact_lock")));
    const insert = calls.find((call) => call.sql.startsWith("INSERT INTO messages"))!;
    assert.deepEqual(insert.values, [12, "user", "persisted"]);
    assert.match(insert.sql, /VALUES \(\$1, \$2, \$3\)/);
  });
});
