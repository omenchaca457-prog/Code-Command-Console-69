import { pool } from "@workspace/db";
import {
  readProjectCode,
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
  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Los argumentos deben ser un objeto JSON.");
    }
    args = parsed as Record<string, unknown>;
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Argumentos JSON inválidos.",
    });
  }

  try {
    if (name === "execute_sql") {
      if (typeof args.query !== "string") throw new Error("Falta el argumento query.");
      return await executeSqlTool(args.query);
    }
    if (name === "get_current_code") {
      if (typeof args.path !== "string") throw new Error("Falta el argumento path.");
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
