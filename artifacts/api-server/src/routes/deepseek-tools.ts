import { pool } from "@workspace/db";
import {
  readProjectCode,
  validateDeepseekToolArguments,
  validateExecuteSqlQuery,
} from "./deepseek-tool-safety";
import { serializeSqlRows } from "./deepseek-serialization";
const MAX_ROWS = 20;

export async function executeSqlTool(query: string): Promise<string> {
  const safeQuery = validateExecuteSqlQuery(query);
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(safeQuery);
    const rows = serializeSqlRows(result.rows.slice(0, MAX_ROWS));
    return JSON.stringify({
      rowCount: result.rowCount,
      rows,
      truncated: result.rows.length > MAX_ROWS,
    });
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}

async function getNeuralActivity(): Promise<string> {
  const { rows } = await pool.query(`
    SELECT id, origin, event_type, content, created_at
    FROM neural_events
    ORDER BY created_at DESC
    LIMIT 10
  `);
  return JSON.stringify(serializeSqlRows(rows));
}

export async function executeDeepseekTool(
  name: string,
  rawArguments: string,
): Promise<string> {
  let args: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    args = validateDeepseekToolArguments(name, parsed);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Argumentos JSON inválidos.",
    });
  }

  try {
    if (name === "execute_sql") {
      return await executeSqlTool(args.query);
    }
    if (name === "get_current_code") {
      return JSON.stringify({
        path: args.path,
        content: await readProjectCode(args.path),
      });
    }
    if (name === "get_neural_activity") {
      return await getNeuralActivity();
    }
    return JSON.stringify({ error: `Herramienta no permitida: ${name}` });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Falló la ejecución de la herramienta.",
    });
  }
}
