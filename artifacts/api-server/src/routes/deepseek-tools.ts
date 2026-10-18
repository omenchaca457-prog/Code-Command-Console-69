import { pool } from "@workspace/db";
import {
  readProjectCode,
  validateDeepseekToolArguments,
  validateExecuteSqlQuery,
} from "./deepseek-tool-safety";
import { serializeSqlRows } from "./deepseek-serialization";
import { getReplitIntegrationStatus } from "./deepseek-integrations";
import { getRuntimeDiagnostics } from "../lib/runtime-diagnostics";
import * as pty from "node-pty";
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

async function getWorkspaceSnapshot(): Promise<string> {
  const [db, agents, snippets] = await Promise.all([
    pool.query("SELECT 1 AS connected"),
    pool.query("SELECT id, name, xp, failed_analyses, last_omega, status FROM agents ORDER BY updated_at DESC LIMIT 20"),
    pool.query("SELECT COUNT(*)::int AS total FROM snippets"),
  ]);
  return JSON.stringify({
    database: db.rows[0]?.connected === 1 ? "connected" : "unknown",
    agents: agents.rows,
    library: { snippets: snippets.rows[0]?.total ?? 0 },
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryBytes: process.memoryUsage().rss,
      envVariableNames: Object.keys(process.env).filter((key) => /^[A-Z][A-Z0-9_]*$/.test(key)).sort(),
    },
    integrations: "Consulta get_integrations_status para ver el estado disponible, sin credenciales.",
  });
}

async function runSafeCommand(commandName: string): Promise<string> {
  const commands: Record<string, [string, string[]]> = {
    git_status: ["git", ["status", "--short"]],
    git_log: ["git", ["log", "--oneline", "-5"]],
    node_version: ["node", ["--version"]],
    pnpm_version: ["pnpm", ["--version"]],
    working_directory: ["pwd", []],
    project_files: ["ls", ["-la"]],
  };
  const spec = commands[commandName];
  if (!spec) throw new Error("Comando no incluido en la lista segura.");
  return await new Promise<string>((resolve, reject) => {
    let output = "";
    let timedOut = false;
    const child = pty.spawn(spec[0], spec[1], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? "/tmp",
        TERM: "xterm-256color",
      },
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 3000);
    child.onData((chunk) => {
      output += chunk;
      if (output.length > 8000) {
        output = output.slice(0, 8000);
        child.kill("SIGTERM");
      }
    });
    child.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      resolve(JSON.stringify({
        command: commandName,
        exitCode,
        timedOut,
        output: output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").slice(0, 8000),
      }));
    });
  });
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
    if (name === "get_runtime_diagnostics") {
      return JSON.stringify(getRuntimeDiagnostics());
    }
    if (name === "get_workspace_snapshot") return await getWorkspaceSnapshot();
    if (name === "get_library_snapshot") {
      const { rows } = await pool.query(
        "SELECT id, title, language, created_at, updated_at FROM snippets ORDER BY updated_at DESC LIMIT 20",
      );
      return JSON.stringify(serializeSqlRows(rows));
    }
    if (name === "get_integrations_status") {
      return JSON.stringify(await getReplitIntegrationStatus());
    }
    if (name === "run_safe_command") return await runSafeCommand(args.command);
    return JSON.stringify({ error: `Herramienta no permitida: ${name}` });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Falló la ejecución de la herramienta.",
    });
  }
}
