import { access, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_QUERY_LENGTH = 4000;
const MAX_FILE_BYTES = 64 * 1024;
const ALLOWED_TABLES = new Set(["agents", "conversations", "messages", "snippets", "neural_events"]);
const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css",
  ".md", ".yaml", ".yml", ".sql", ".py", ".sh",
]);
const BLOCKED_SEGMENTS = new Set([".git", "node_modules", "attached_assets", "dist", ".local"]);

export function validateDeepseekToolArguments(
  name: string,
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Los argumentos deben ser un objeto JSON.");
  }
  const allowedKeys =
    name === "execute_sql" ? ["query"] :
    name === "get_current_code" ? ["path"] :
    ["get_neural_activity", "get_runtime_diagnostics", "get_workspace_snapshot",
      "get_library_snapshot", "get_integrations_status"].includes(name) ? [] :
    name === "run_safe_command" ? ["command"] :
    null;
  if (!allowedKeys) throw new Error(`Herramienta no permitida: ${name}`);

  const args = value as Record<string, unknown>;
  const keys = Object.keys(args);
  if (
    keys.length !== allowedKeys.length ||
    keys.some((key) => !allowedKeys.includes(key)) ||
    allowedKeys.some((key) => !Object.hasOwn(args, key))
  ) {
    throw new Error(`Argumentos inválidos para ${name}.`);
  }
  if (allowedKeys.length === 0) return {};

  const argument = args[allowedKeys[0]!];
  if (typeof argument !== "string" || !argument.trim()) {
    throw new Error(`El argumento ${allowedKeys[0]} debe ser texto no vacío.`);
  }
  if (name === "run_safe_command" && ![
    "git_status", "git_log", "node_version", "pnpm_version", "working_directory", "project_files",
  ].includes(argument)) {
    throw new Error("Comando no incluido en la lista segura.");
  }
  if (name === "execute_sql") validateExecuteSqlQuery(argument);
  else validateProjectCodePath(argument);
  return args as Record<string, string>;
}

export function validateExecuteSqlQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) {
    throw new Error(`La consulta debe tener entre 1 y ${MAX_QUERY_LENGTH} caracteres.`);
  }
  const singleStatement = trimmed.replace(/;\s*$/, "");
  if (
    !/^select\b/i.test(singleStatement) ||
    singleStatement.includes(";") ||
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do|commit|rollback|setval|nextval|pg_read_file|pg_ls_dir|pg_terminate_backend|dblink)\b/i.test(singleStatement) ||
    /\b(from|join)\s+((pg_catalog|information_schema)\s*\.)/i.test(singleStatement)
  ) {
    throw new Error("execute_sql solo permite una consulta SELECT de lectura sobre datos de la aplicación.");
  }

  const relations = [...singleStatement.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)(?:\s*\.)?/gi)]
    .map((match) => match[1]?.toLowerCase())
    .filter((table): table is string => Boolean(table));
  if (relations.some((table) => !ALLOWED_TABLES.has(table))) {
    throw new Error("execute_sql solo puede consultar tablas permitidas de la aplicación.");
  }
  return singleStatement;
}

function validateProjectCodePath(relativePath: string): void {
  const segments = relativePath.split(/[\\/]/);
  if (
    relativePath.length > 300 ||
    isAbsolute(relativePath) ||
    segments.some((segment) =>
      !segment ||
      segment === "." ||
      segment === ".." ||
      BLOCKED_SEGMENTS.has(segment) ||
      segment.toLowerCase().startsWith(".env"),
    )
  ) {
    throw new Error("La ruta debe ser relativa y apuntar a un archivo de código del proyecto.");
  }
}

async function findWorkspaceRoot(start = process.cwd()): Promise<string> {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      await access(resolve(current, "pnpm-workspace.yaml"), constants.R_OK);
      return realpath(current);
    } catch {
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error("No se pudo localizar la raíz del proyecto.");
}

export async function readProjectCode(relativePath: string): Promise<string> {
  validateProjectCodePath(relativePath);

  const root = await findWorkspaceRoot();
  const target = await realpath(resolve(root, relativePath));
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new Error("La ruta solicitada queda fuera del proyecto.");
  }
  const fileName = rel.split(sep).at(-1) ?? "";
  if (fileName.toLowerCase().startsWith(".env") || !ALLOWED_EXTENSIONS.has(extname(fileName).toLowerCase())) {
    throw new Error("No se permite leer archivos de configuración sensible o de tipo no compatible.");
  }
  const metadata = await stat(target);
  if (!metadata.isFile() || metadata.size > MAX_FILE_BYTES) {
    throw new Error("El archivo no existe, no es regular o supera el límite de 64 KiB.");
  }
  return (await readFile(target, "utf8")).slice(0, MAX_FILE_BYTES);
}
