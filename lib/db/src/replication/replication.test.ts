import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyReplicationEvent } from "./replica-apply.ts";
import { classifyReplicaBootstrap } from "./bootstrap-policy.ts";
import { inspectReplicationStatus } from "./replication-status.ts";
import { assertReplicaPayloadSafe } from "./replication-safety.ts";
import { REPLICATED_TABLES, type ReplicationEvent } from "./replicated-tables.ts";
import {
  processNextReplicationEvent,
  replicationBackoffMs,
} from "./replica-worker.ts";

const conversationEvent: ReplicationEvent = {
  id: "12",
  event_id: "00000000-0000-4000-8000-000000000012",
  table_name: "conversations",
  record_key: "3",
  operation: "upsert",
  payload: { id: 3, title: "Test", created_at: "2026-01-01T00:00:00.000Z" },
  attempts: 0,
};

class FakeClient {
  readonly statements: Array<{ sql: string; values: unknown[] }> = [];
  readonly updates: unknown[][] = [];
  private readonly event: ReplicationEvent;
  private readonly acquired: boolean;

  constructor(event: ReplicationEvent, acquired = true) {
    this.event = event;
    this.acquired = acquired;
  }

  async query(sql: string, values: unknown[] = []) {
    this.statements.push({ sql, values });
    if (sql.includes("pg_try_advisory_xact_lock")) {
      return { rows: [{ acquired: this.acquired }] };
    }
    if (sql.includes("SELECT enabled FROM public.replication_control")) {
      return { rows: [{ enabled: true }] };
    }
    if (sql.includes("FROM public.replication_outbox") && sql.includes("FOR UPDATE")) {
      return { rows: [this.event] };
    }
    if (sql.includes("UPDATE public.replication_outbox")) this.updates.push(values);
    return { rows: [] };
  }

  release() {}
}

function fakePool(client: FakeClient) {
  return { connect: async () => client } as unknown as Pick<import("pg").Pool, "connect">;
}

function duplicateNeonPool() {
  const statements: string[] = [];
  const client = {
    async query(sql: string) {
      statements.push(sql);
      if (sql.includes("INSERT INTO public.replica_applied_events")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    pool: { connect: async () => client } as unknown as Pick<import("pg").Pool, "connect">,
    statements,
  };
}

describe("one-way PostgreSQL replication", () => {
  it("keeps Neon optional and never uses it as the primary fallback", async () => {
    const result = await inspectReplicationStatus({
      primaryPool: { query: async () => ({ rows: [{}] }) } as never,
      neonPool: null,
      primaryConfigured: true,
      neonConfigured: false,
    });
    assert.equal(result.primary, "ready");
    assert.equal(result.replica, "not_configured");
    assert.equal(result.replication.enabled, false);
  });

  it("reports a failed replica independently while the primary remains ready", async () => {
    const result = await inspectReplicationStatus({
      primaryPool: {
        async query(sql: string) {
          if (sql === "SELECT 1") return { rows: [{}] };
          if (sql.includes("replication_control")) {
            return { rows: [{ enabled: true, last_success_at: null }] };
          }
          return { rows: [{ pending: 1, failed: 0, oldest_pending: new Date(0) }] };
        },
      } as never,
      neonPool: {
        async query() {
          throw Object.assign(new Error("connection failure"), { code: "ECONNREFUSED" });
        },
      } as never,
      primaryConfigured: true,
      neonConfigured: true,
      now: () => 10_000,
    });
    assert.equal(result.primary, "ready");
    assert.equal(result.replica, "unavailable");
    assert.equal(result.replication.state, "degraded");
    assert.equal(result.replication.pending, 1);
    assert.equal(result.replication.lagMs, 10_000);
  });

  it("leaves a primary event pending with backoff when Neon is down", async () => {
    const primaryClient = new FakeClient(conversationEvent);
    const neonPool = {
      connect: async () => {
        throw Object.assign(new Error("offline"), { code: "ECONNREFUSED" });
      },
    } as unknown as Pick<import("pg").Pool, "connect">;
    const status = await processNextReplicationEvent(
      fakePool(primaryClient),
      neonPool,
      { now: () => new Date(10_000), random: () => 0 },
    );
    assert.equal(status, "retry");
    const update = primaryClient.statements.find(({ sql }) =>
      sql.includes("UPDATE public.replication_outbox")
    );
    assert.equal(update?.values[0], 1);
    assert.equal(update?.values[1], "pending");
    assert.equal(update?.values[3], "ECONNREFUSED");
    assert.ok((update?.values[2] as Date).getTime() > 10_000);
  });

  it("marks events failed after the bounded retry limit", async () => {
    const primaryClient = new FakeClient({ ...conversationEvent, attempts: 7 });
    const neonPool = {
      connect: async () => {
        throw Object.assign(new Error("offline"), { code: "ECONNREFUSED" });
      },
    } as unknown as Pick<import("pg").Pool, "connect">;
    const status = await processNextReplicationEvent(
      fakePool(primaryClient),
      neonPool,
      { now: () => new Date(10_000), random: () => 0 },
    );
    assert.equal(status, "failed");
    assert.equal(primaryClient.updates[0]?.[1], "failed");
  });

  it("uses bounded exponential backoff", () => {
    assert.equal(replicationBackoffMs(1, () => 0), 800);
    assert.ok(replicationBackoffMs(30, () => 1) <= 60_000);
  });

  it("blocks credential-like content without including it in the error", () => {
    const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";
    assert.throws(
      () => assertReplicaPayloadSafe({ content: `api_key=${secret}` }),
      (error: unknown) => error instanceof Error
        && error.message.includes("credential-like")
        && !error.message.includes(secret),
    );
  });

  it("preserves idempotence after a Neon commit and primary restart", async () => {
    const { pool, statements } = duplicateNeonPool();
    const result = await applyReplicationEvent(pool, conversationEvent);
    assert.deepEqual(result, { duplicate: true });
    assert.ok(statements.some((sql) => sql === "COMMIT"));
    assert.ok(!statements.some((sql) => sql.includes("INSERT INTO public.conversations")));
  });

  it("keeps foreign-key parents before their dependent rows", () => {
    const order = REPLICATED_TABLES.map(({ name }) => name);
    assert.ok(order.indexOf("conversations") < order.indexOf("messages"));
    assert.ok(order.indexOf("conversations") < order.indexOf("prompts"));
    assert.ok(order.indexOf("agents") < order.indexOf("prompts"));
  });

  it("refuses to initialize a non-empty replica with conflicting rows", () => {
    assert.throws(
      () => classifyReplicaBootstrap(
        [{ table: "conversations", rows: 2, checksum: "source" }],
        [{ table: "conversations", rows: 1, checksum: "other" }],
      ),
      /conflicting data/,
    );
  });

  it("only copies into an empty target or verifies an exact existing match", () => {
    assert.equal(
      classifyReplicaBootstrap(
        [{ table: "conversations", rows: 2, checksum: "source" }],
        [{ table: "conversations", rows: 0, checksum: "empty" }],
      ),
      "copy-empty-target",
    );
    assert.equal(
      classifyReplicaBootstrap(
        [{ table: "conversations", rows: 1, checksum: "same" }],
        [{ table: "conversations", rows: 1, checksum: "same" }],
      ),
      "verify-existing",
    );
  });

  it("applies a pending event idempotently when a worker resumes after restart", async () => {
    const primaryClient = new FakeClient(conversationEvent);
    const { pool, statements } = duplicateNeonPool();
    const status = await processNextReplicationEvent(
      fakePool(primaryClient),
      pool,
      { now: () => new Date(20_000) },
    );
    assert.equal(status, "sent");
    assert.ok(statements.some((sql) => sql === "COMMIT"));
    assert.equal(primaryClient.updates[0]?.[1], "sent");
  });
});
