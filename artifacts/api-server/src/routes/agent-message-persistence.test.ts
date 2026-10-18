import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import pg from "pg";

const { Client } = pg;

describe("agent response idempotency in PostgreSQL", { skip: !process.env.DATABASE_URL }, () => {
  it("keeps one assistant message when the same run is saved twice", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const idempotencyKey = randomUUID();

    await client.connect();
    try {
      await client.query("BEGIN");
      const conversation = await client.query<{ id: number }>(
        "INSERT INTO conversations (title) VALUES ($1) RETURNING id",
        ["Idempotency integration test"],
      );
      const conversationId = conversation.rows[0].id;

      const insert = () =>
        client.query<{ id: number }>(
          `INSERT INTO messages (conversation_id, role, content, idempotency_key)
           VALUES ($1, 'assistant', $2, $3)
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING id`,
          [conversationId, "Ω: 0.95", idempotencyKey],
        );

      const first = await insert();
      const retry = await insert();
      const count = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM messages WHERE idempotency_key = $1",
        [idempotencyKey],
      );

      assert.equal(first.rows.length, 1);
      assert.equal(retry.rows.length, 0);
      assert.equal(count.rows[0].count, 1);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
