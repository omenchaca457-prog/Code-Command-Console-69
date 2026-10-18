import { access, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_QUERY_LENGTH = 4000;
const MAX_FILE_BYTES = 64 * 1024;
const ALLOWED_TABLES = new Set(["agents", "conversations", "messages", "snippets"]);
const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css",
  ".md", ".yaml", ".yml", ".sql", ".py", ".sh",
]);
const BLOCKED_SEGMENTS = new Set([".git", "node_modules", "attached_assets", "dist", ".local"]);

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
    throw new Error("execute_sql solo puede consultar agents, conversations, messages o snippets.");
  }
  return singleStatement;
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
  if (
    !relativePath ||
    relativePath.length > 300 ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).some((segment) =>
      !segment ||
      segment === "." ||
      segment === ".." ||
      BLOCKED_SEGMENTS.has(segment),
    )
  ) {
    throw new Error("La ruta debe ser relativa y apuntar a un archivo de código del proyecto.");
  }

  const root = await findWorkspaceRoot();
  const target = await realpath(resolve(root, relativePath));
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    throw new Error("La ruta solicitada queda fuera del proyecto.");
  }
  const fileName = rel.split(sep).at(-1) ?? "";
  if (fileName.startsWith(".env") || !ALLOWED_EXTENSIONS.has(extname(fileName).toLowerCase())) {
    throw new Error("No se permite leer archivos de configuración sensible o de tipo no compatible.");
  }
  const metadata = await stat(target);
  if (!metadata.isFile() || metadata.size > MAX_FILE_BYTES) {
    throw new Error("El archivo no existe, no es regular o supera el límite de 64 KiB.");
  }
  return (await readFile(target, "utf8")).slice(0, MAX_FILE_BYTES);
}
