import type { Pool, PoolClient, QueryResult } from "pg";

type SqlPool = Pick<Pool, "query" | "connect">;
type SqlClient = Pick<PoolClient, "query" | "release">;

export type SnippetRecord = {
  id: number;
  title: string;
  code: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
};

export type TerminalMessageRecord = {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type SimulatedSnippetExecution = {
  id: number;
  success: true;
  simulated: true;
  output: "Hello, DevTerminal!";
  lastRunAt: Date;
};

export type CorePersistenceStore = {
  listSnippets(): Promise<SnippetRecord[]>;
  listRecentSnippets(): Promise<SnippetRecord[]>;
  getSnippet(id: number): Promise<SnippetRecord | null>;
  createSnippet(input: Pick<SnippetRecord, "title" | "code" | "language">): Promise<SnippetRecord>;
  updateSnippet(
    id: number,
    updates: Partial<Pick<SnippetRecord, "title" | "code" | "language">>,
  ): Promise<SnippetRecord | null>;
  deleteSnippet(id: number): Promise<boolean>;
  recordSimulatedSnippetExecution(id: number): Promise<SimulatedSnippetExecution | null>;
  listTerminalMessages(): Promise<TerminalMessageRecord[]>;
  createTerminalMessage(
    role: TerminalMessageRecord["role"],
    content: string,
  ): Promise<TerminalMessageRecord>;
  clearTerminalMessages(): Promise<number>;
};

type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
};

type Connectable = {
  connect(): Promise<SqlClient>;
};

const TERMINAL_SESSION_ID = "terminal_main_session";
const SIMULATED_OUTPUT = "Hello, DevTerminal!" as const;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapSnippet(row: Record<string, unknown>): SnippetRecord {
  return {
    id: Number(row.id),
    title: String(row.title),
    code: String(row.code),
    language: String(row.language),
    createdAt: toDate(row.created_at as Date | string),
    updatedAt: toDate(row.updated_at as Date | string),
    lastRunAt: row.last_run_at == null ? null : toDate(row.last_run_at as Date | string),
  };
}

function mapMessage(row: Record<string, unknown>): TerminalMessageRecord {
  return {
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    role: row.role as TerminalMessageRecord["role"],
    content: String(row.content),
    createdAt: toDate(row.created_at as Date | string),
  };
}

async function withTransaction<T>(
  pool: Connectable,
  action: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  } finally {
    client.release();
  }
}

function createMemoryStore(): CorePersistenceStore {
  const snippets = new Map<number, SnippetRecord>();
  const messages: TerminalMessageRecord[] = [];
  let nextSnippetId = 1;
  let nextMessageId = 1;
  const conversationId = 1;

  return {
    async listSnippets() {
      return [...snippets.values()]
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },
    async listRecentSnippets() {
      return (await this.listSnippets()).slice(0, 5);
    },
    async getSnippet(id) {
      return snippets.get(id) ?? null;
    },
    async createSnippet(input) {
      const now = new Date();
      const snippet: SnippetRecord = {
        id: nextSnippetId++,
        ...input,
        createdAt: now,
        updatedAt: now,
        lastRunAt: null,
      };
      snippets.set(snippet.id, snippet);
      return snippet;
    },
    async updateSnippet(id, updates) {
      const existing = snippets.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      snippets.set(id, updated);
      return updated;
    },
    async deleteSnippet(id) {
      return snippets.delete(id);
    },
    async recordSimulatedSnippetExecution(id) {
      const snippet = snippets.get(id);
      if (!snippet) return null;
      const lastRunAt = new Date();
      snippets.set(id, { ...snippet, lastRunAt });
      return { id, success: true, simulated: true, output: SIMULATED_OUTPUT, lastRunAt };
    },
    async listTerminalMessages() {
      return messages.map((message) => ({ ...message }));
    },
    async createTerminalMessage(role, content) {
      const message: TerminalMessageRecord = {
        id: nextMessageId++,
        conversationId,
        role,
        content,
        createdAt: new Date(),
      };
      messages.push(message);
      return message;
    },
    async clearTerminalMessages() {
      const previousLength = messages.length;
      messages.length = 0;
      return previousLength;
    },
  };
}

async function getOrCreateTerminalConversationId(
  pool: Connectable,
): Promise<number> {
  return withTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      TERMINAL_SESSION_ID,
    ]);
    const found = await client.query<{ id: number }>(
      "SELECT id FROM conversations WHERE title = $1 ORDER BY id ASC LIMIT 1",
      [TERMINAL_SESSION_ID],
    );
    if (found.rows[0]) return Number(found.rows[0].id);
    const created = await client.query<{ id: number }>(
      "INSERT INTO conversations (title) VALUES ($1) RETURNING id",
      [TERMINAL_SESSION_ID],
    );
    return Number(created.rows[0]!.id);
  });
}

export function createCorePersistenceStore(
  pool: SqlPool & Partial<Connectable>,
  usePostgres: boolean,
): CorePersistenceStore {
  if (!usePostgres) return createMemoryStore();
  const connectable = pool as SqlPool & Connectable;
  const queryable = pool as Queryable;

  return {
    async listSnippets() {
      const { rows } = await queryable.query(
        "SELECT id, title, code, language, created_at, updated_at, last_run_at FROM snippets ORDER BY updated_at DESC, id DESC",
      );
      return rows.map(mapSnippet);
    },
    async listRecentSnippets() {
      const { rows } = await queryable.query(
        "SELECT id, title, code, language, created_at, updated_at, last_run_at FROM snippets ORDER BY updated_at DESC, id DESC LIMIT 5",
      );
      return rows.map(mapSnippet);
    },
    async getSnippet(id) {
      const { rows } = await queryable.query(
        "SELECT id, title, code, language, created_at, updated_at, last_run_at FROM snippets WHERE id = $1 LIMIT 1",
        [id],
      );
      return rows[0] ? mapSnippet(rows[0]) : null;
    },
    async createSnippet(input) {
      const { rows } = await queryable.query(
        `INSERT INTO snippets (title, code, language)
         VALUES ($1, $2, $3)
         RETURNING id, title, code, language, created_at, updated_at, last_run_at`,
        [input.title, input.code, input.language],
      );
      return mapSnippet(rows[0]!);
    },
    async updateSnippet(id, updates) {
      const allowedColumns = {
        title: "title",
        code: "code",
        language: "language",
      } as const;
      const entries = Object.entries(updates) as Array<
        [keyof typeof allowedColumns, string]
      >;
      const assignments = entries.map(
        ([field], index) => `${allowedColumns[field]} = $${index + 2}`,
      );
      assignments.push("updated_at = NOW()");
      const values = [id, ...entries.map(([, value]) => value)];
      const { rows } = await queryable.query(
        `UPDATE snippets SET ${assignments.join(", ")}
         WHERE id = $1
         RETURNING id, title, code, language, created_at, updated_at, last_run_at`,
        values,
      );
      return rows[0] ? mapSnippet(rows[0]) : null;
    },
    async deleteSnippet(id) {
      const result = await queryable.query(
        "DELETE FROM snippets WHERE id = $1",
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    },
    async recordSimulatedSnippetExecution(id) {
      return withTransaction(connectable, async (client) => {
        const { rows } = await client.query(
          `UPDATE snippets SET last_run_at = NOW()
           WHERE id = $1
           RETURNING id, last_run_at`,
          [id],
        );
        const snippet = rows[0];
        if (!snippet) return null;
        const result: SimulatedSnippetExecution = {
          id: Number(snippet.id),
          success: true,
          simulated: true,
          output: SIMULATED_OUTPUT,
          lastRunAt: toDate(snippet.last_run_at as Date | string),
        };
        await client.query(
          `INSERT INTO neural_events (origin, event_type, content)
           VALUES ($1, $2, $3)`,
          ["runner", "snippet_execution_simulated", JSON.stringify(result)],
        );
        return result;
      });
    },
    async listTerminalMessages() {
      const conversationId = await getOrCreateTerminalConversationId(connectable);
      const { rows } = await queryable.query(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = $1 AND role IN ('user', 'assistant')
         ORDER BY id ASC`,
        [conversationId],
      );
      return rows.map(mapMessage);
    },
    async createTerminalMessage(role, content) {
      const conversationId = await getOrCreateTerminalConversationId(connectable);
      const { rows } = await queryable.query(
        `INSERT INTO messages (conversation_id, role, content)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, role, content, created_at`,
        [conversationId, role, content],
      );
      return mapMessage(rows[0]!);
    },
    async clearTerminalMessages() {
      const conversationId = await getOrCreateTerminalConversationId(connectable);
      const result = await queryable.query(
        `DELETE FROM messages
         WHERE conversation_id = $1 AND role IN ('user', 'assistant')`,
        [conversationId],
      );
      return result.rowCount ?? 0;
    },
  };
}
