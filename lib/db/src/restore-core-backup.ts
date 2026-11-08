import type { Pool, PoolClient } from "pg";
import type { CoreBackupData } from "./backup-copy.ts";

type RestoreClient = Pick<PoolClient, "query" | "release">;
type RestorePool = Pick<Pool, "connect">;

const SEQUENCE_TARGETS = [
  { table: "conversations", sequence: "conversations_id_seq" },
  { table: "messages", sequence: "messages_id_seq" },
  { table: "snippets", sequence: "snippets_id_seq" },
] as const;

export type BackupRestoreCounts = {
  conversations: number;
  messages: number;
  snippets: number;
};

async function advanceSequenceIfNeeded(
  client: RestoreClient,
  table: (typeof SEQUENCE_TARGETS)[number]["table"],
  sequence: (typeof SEQUENCE_TARGETS)[number]["sequence"],
): Promise<void> {
  const { rows: maxRows } = await client.query(
    `SELECT MAX(id) AS max_id FROM public.${table}`,
  );
  const maxId = maxRows[0]?.max_id == null ? null : Number(maxRows[0].max_id);
  if (maxId === null || !Number.isSafeInteger(maxId)) return;

  const { rows: sequenceRows } = await client.query(
    `SELECT last_value, is_called FROM public.${sequence}`,
  );
  const lastValue = Number(sequenceRows[0]?.last_value ?? 0);
  const called = Boolean(sequenceRows[0]?.is_called);
  if (lastValue < maxId || (lastValue === maxId && !called)) {
    await client.query(
      "SELECT setval($1::regclass, $2, true)",
      [`public.${sequence}`, Math.max(maxId, 1)],
    );
  }
}

export async function restoreCoreBackupIntoEmptyDatabase(
  pool: RestorePool,
  backup: CoreBackupData,
): Promise<BackupRestoreCounts> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `LOCK TABLE public.conversations, public.messages, public.snippets
       IN ACCESS EXCLUSIVE MODE`,
    );
    const { rows } = await client.query(
      `SELECT
        EXISTS (SELECT 1 FROM public.conversations LIMIT 1) AS conversations_populated,
        EXISTS (SELECT 1 FROM public.messages LIMIT 1) AS messages_populated,
        EXISTS (SELECT 1 FROM public.snippets LIMIT 1) AS snippets_populated`,
    );
    const populated = rows[0] ?? {};
    if (
      populated.conversations_populated === true ||
      populated.messages_populated === true ||
      populated.snippets_populated === true
    ) {
      throw new Error(
        "Restore refused: conversations, messages, and snippets must all be empty. No rows were changed.",
      );
    }

    for (const row of backup.conversations) {
      await client.query(
        `INSERT INTO public.conversations (id, title, created_at)
         VALUES ($1, $2, $3)`,
        [row.id, row.title, row.created_at],
      );
    }
    for (const row of backup.messages) {
      await client.query(
        `INSERT INTO public.messages (id, conversation_id, role, content, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.id, row.conversation_id, row.role, row.content, row.created_at],
      );
    }
    for (const row of backup.snippets) {
      await client.query(
        `INSERT INTO public.snippets
          (id, title, code, language, created_at, updated_at, last_run_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.id,
          row.title,
          row.code,
          row.language,
          row.created_at,
          row.updated_at,
          row.last_run_at,
        ],
      );
    }

    for (const target of SEQUENCE_TARGETS) {
      await advanceSequenceIfNeeded(client, target.table, target.sequence);
    }

    await client.query("COMMIT");
    return {
      conversations: backup.conversations.length,
      messages: backup.messages.length,
      snippets: backup.snippets.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}
