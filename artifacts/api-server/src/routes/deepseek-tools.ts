import { pool } from "@workspace/db";
import {
  readProjectCode,
  validateDeepseekToolArguments,
  validateExecuteSqlQuery,
} from "./deepseek-tool-safety";
const MAX_ROWS = 20;
const MAX_CELL_CHARS = 4000;

export async function executeSqlTool(query: string): Promise<string> {
  const safeQuery = validateExecuteSqlQuery(query);
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(safeQuery);
    const rows = result.rows.slice(0, MAX_ROWS).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          const serialized = typeof value === "string" ? value : JSON.stringify(value);
          return [key, serialized?.slice(0, MAX_CELL_CHARS) ?? null];
        }),
      ),
    );
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
    return JSON.stringify({ error: `Herramienta no permitida: ${name}` });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Falló la ejecución de la herramienta.",
    });
  }
}
