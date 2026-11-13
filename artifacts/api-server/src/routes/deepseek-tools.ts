import {
  readProjectCode,
  validateDeepseekToolArguments,
  validateExecuteSqlQuery,
  writeProjectCode,
} from "./deepseek-tool-safety.ts";
import { serializeSqlRows } from "./deepseek-serialization.ts";
import { getRuntimeIntegrationStatus } from "./deepseek-integrations.ts";
import { getRuntimeDiagnostics } from "../lib/runtime-diagnostics.ts";
import { publishNeuralEvent } from "./neural-event-bus.ts";
const MAX_ROWS = 20;

export async function executeSqlTool(query: string): Promise<string> {
  const { pool } = await import("@workspace/db");
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
  const { pool } = await import("@workspace/db");
  const { rows } = await pool.query(`
    SELECT id, origin, event_type, content, created_at
    FROM neural_events
    ORDER BY created_at DESC
    LIMIT 10
  `);
  return JSON.stringify(serializeSqlRows(rows));
}

async function getWorkspaceSnapshot(): Promise<string> {
  const { pool } = await import("@workspace/db");
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

type DeepseekToolDependencies = {
  writeProjectCode: typeof writeProjectCode;
  persistNeuralEvent: (event: {
    origin: "terminal";
    eventType: "autonomous_write";
    content: string;
  }) => Promise<{
    id: number;
    origin: "terminal";
    eventType: "autonomous_write";
    content: string;
    createdAt: Date;
  } | undefined>;
  publishNeuralEvent: typeof publishNeuralEvent;
};

type WriteNotificationResult =
  | { status: "delivered"; persisted: true }
  | {
      status: "failed";
      stage: "persistence" | "realtime";
      retry: "not_attempted";
      recovery: string;
      message: string;
    };

const defaultToolDependencies: DeepseekToolDependencies = {
  writeProjectCode,
  persistNeuralEvent: async (event) => {
    const { db, neuralEventsTable } = await import("@workspace/db");
    const [created] = await db.insert(neuralEventsTable).values(event).returning();
    return created
      ? {
          ...created,
          origin: "terminal" as const,
          eventType: "autonomous_write" as const,
        }
      : undefined;
  },
  publishNeuralEvent,
};

export function createDeepseekToolExecutor(
  overrides: Partial<DeepseekToolDependencies> = {},
) {
  const dependencies = { ...defaultToolDependencies, ...overrides };

  return async function executeDeepseekTool(
    name: string,
    rawArguments: string,
  ): Promise<string> {
  if (name === "run_safe_command") {
    return JSON.stringify({
      error: "La ejecución de comandos está desactivada por seguridad.",
      code: "execution_disabled",
    });
  }

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
    if (name === "write_project_file" || name === "write_file") {
      const result = await dependencies.writeProjectCode(args.path, args.content);
      const eventContent = `[AUTONOMOUS WRITE] Archivo actualizado -> Ejecutando en PTY... ${result.path}`;
      let notification: WriteNotificationResult;
      try {
        const event = await dependencies.persistNeuralEvent({
          origin: "terminal",
          eventType: "autonomous_write",
          content: eventContent,
        });
        if (!event) {
          notification = {
            status: "failed",
            stage: "persistence",
            retry: "not_attempted",
            recovery: "No se reintentó automáticamente porque no se puede descartar que el guardado se haya confirmado tarde.",
            message: "El archivo se guardó, pero no se confirmó el aviso de actividad.",
          };
        } else {
          try {
            await dependencies.publishNeuralEvent({
              id: event.id,
              origin: event.origin,
              eventType: event.eventType,
              content: event.content,
              createdAt: event.createdAt.toISOString(),
            });
            notification = { status: "delivered", persisted: true };
          } catch {
            notification = {
              status: "failed",
              stage: "realtime",
              retry: "not_attempted",
              recovery: "El evento quedó guardado y puede recuperarse cuando el flujo se reconecte.",
              message: "El archivo y el aviso quedaron guardados, pero falló su difusión en tiempo real.",
            };
          }
        }
      } catch {
        notification = {
          status: "failed",
          stage: "persistence",
          retry: "not_attempted",
          recovery: "No se reintentó automáticamente porque no se puede descartar que el guardado se haya confirmado tarde.",
          message: "El archivo se guardó, pero falló el almacenamiento del aviso de actividad.",
        };
      }
      return JSON.stringify({
        ...result,
        status: "written",
        runtime: "El archivo está guardado; los watchers del proyecto aplicarán el cambio.",
        notification,
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
      const { pool } = await import("@workspace/db");
      const { rows } = await pool.query(
        "SELECT id, title, language, created_at, updated_at FROM snippets ORDER BY updated_at DESC LIMIT 20",
      );
      return JSON.stringify(serializeSqlRows(rows));
    }
    if (name === "get_integrations_status") {
      return JSON.stringify(getRuntimeIntegrationStatus());
    }
    return JSON.stringify({ error: `Herramienta no permitida: ${name}` });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Falló la ejecución de la herramienta.",
    });
  }
  };
}

export function getWriteNotificationSummary(toolResult: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(toolResult);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  if (result.status !== "written" || typeof result.path !== "string") return null;
  if (!result.notification || typeof result.notification !== "object") return null;

  const notification = result.notification as Record<string, unknown>;
  if (notification.status !== "failed") return null;
  const message = typeof notification.message === "string"
    ? notification.message
    : "El archivo se guardó, pero no se confirmó el aviso de actividad.";
  const recovery = typeof notification.recovery === "string"
    ? notification.recovery
    : "No se reintentó automáticamente para evitar avisos duplicados.";
  return `[AVISO DE ACTIVIDAD] ${message} ${recovery}`;
}

export const executeDeepseekTool = createDeepseekToolExecutor();
