import assert from "node:assert/strict";
import { it } from "node:test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { integer, doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { completePersistedTask } from "./agents-simulation.ts";
import { recordAgentTaskFailure, taskSuccessOmega, type AgentTaskStore } from "./agent-task-outcomes.ts";
import { initializeAgentTelemetry } from "./agent-telemetry-initialization.ts";

it("keeps unknown task Ω distinct from an observed failed task", () => {
  assert.equal(taskSuccessOmega(0, 0), null);
  assert.equal(taskSuccessOmega(0, 1), 0);
  assert.equal(taskSuccessOmega(1, 0), 1);
  assert.equal(taskSuccessOmega(3, 1), 0.75);
});

it("rejects invalid task counts instead of inventing an Ω", () => {
  for (const [successes, failures] of [
    [-1, 1], [1, -1], [0.5, 0], [NaN, 0], [0, Infinity],
    [Number.MAX_SAFE_INTEGER, 1],
  ]) {
    assert.throws(() => taskSuccessOmega(successes, failures), RangeError);
  }
});

it("persists independent per-agent Ω for identical motor inputs and atomic concurrent updates",
  { skip: !process.env.DATABASE_URL }, async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(`CREATE TEMP TABLE agents (
        id text PRIMARY KEY, name text NOT NULL, xp integer NOT NULL DEFAULT 0,
        failed_analyses integer NOT NULL DEFAULT 0, successful_tasks integer NOT NULL DEFAULT 0,
        failed_tasks integer NOT NULL DEFAULT 0, last_omega double precision,
        last_failure text, status text NOT NULL DEFAULT 'idle',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      const agentsTable = pgTable("agents", {
        id: text("id").primaryKey(), name: text("name").notNull(),
        xp: integer("xp").notNull().default(0),
        failedAnalyses: integer("failed_analyses").notNull().default(0),
        successfulTasks: integer("successful_tasks").notNull().default(0),
        failedTasks: integer("failed_tasks").notNull().default(0),
        lastOmega: doublePrecision("last_omega"), lastFailure: text("last_failure"),
        status: text("status").notNull().default("idle"),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
      });
      const store = { db: drizzle(client), agentsTable } as unknown as AgentTaskStore;
      const task = (agentId: string, agentName: string) => ({
        agentId, agentName, vector: "1234", coherence: 96.9,
      });
      await completePersistedTask(task("optimizer", "Optimizer"), store);
      await recordAgentTaskFailure("security", "Test failure", false, store);
      const results = await Promise.all([
        completePersistedTask(task("optimizer", "Optimizer"), store),
        completePersistedTask(task("security", "Security"), store),
        completePersistedTask(task("coherence", "Coherencia 4105"), store),
      ]);
      assert.deepEqual(results.map(result => result.omega), [1, 0.5, 1]);
      assert.ok(results.every(result => result.omega !== 0.969));
      await Promise.all(Array.from({ length: 5 }, () =>
        completePersistedTask(task("security", "Security"), store)));
      const { rows } = await client.query("SELECT successful_tasks, failed_tasks, last_omega FROM agents WHERE id = 'security'");
      assert.equal(rows[0].successful_tasks, 6);
      assert.equal(rows[0].failed_tasks, 1);
      assert.equal(rows[0].last_omega, 6 / 7);
      await client.query("UPDATE agents SET last_omega = 0.969");
      await client.query("INSERT INTO agents (id, name, status) VALUES ('orquestador-openai', 'ORQUESTADOR-OPENAI', 'completed')");
      await initializeAgentTelemetry(store);
      const reconciled = await client.query("SELECT id, last_omega, status FROM agents ORDER BY id");
      assert.deepEqual(reconciled.rows.map(row => [row.id, row.last_omega]), [
        ["coherence", 1], ["optimizer", 1], ["orquestador-openai", null], ["security", 6 / 7],
      ]);
      assert.equal(reconciled.rows.find(row => row.id === "orquestador-openai").status, "idle");
      await client.query("UPDATE agents SET successful_tasks = 0, failed_tasks = 0, last_omega = 0.969 WHERE id = 'coherence'");
      await initializeAgentTelemetry(store);
      const unknown = await client.query("SELECT last_omega FROM agents WHERE id = 'coherence'");
      assert.equal(unknown.rows[0].last_omega, null);
      // Legacy XP and an old score of 1 must not override observed task failures.
      await client.query("UPDATE agents SET xp = 999, failed_tasks = 2, last_omega = 1 WHERE id = 'coherence'");
      const recovered = await completePersistedTask(task("coherence", "Coherencia 4105"), store);
      assert.equal(recovered.xp, 1000);
      assert.equal(recovered.omega, 1 / 3);
    } finally {
      await client.end();
    }
  });
