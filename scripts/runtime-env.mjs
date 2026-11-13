import { existsSync } from "node:fs";
import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");

export function databaseUrlFromEnvironment(environment) {
  if (environment.DATABASE_URL?.trim()) return environment.DATABASE_URL;
  if (!environment.PGHOST) return undefined;
  const port = Number(environment.PGPORT || "5432");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PGPORT debe ser un número entre 1 y 65535.");
  const host = environment.PGHOST.includes(":") && !environment.PGHOST.startsWith("[")
    ? `[${environment.PGHOST}]`
    : environment.PGHOST;
  if (/[\s/@?#]/.test(host)) throw new Error("PGHOST debe ser un nombre de servidor o una dirección IP.");
  const connection = new URL("postgresql://localhost");
  connection.hostname = host;
  if (connection.hostname.toLowerCase() !== host.toLowerCase()) throw new Error("PGHOST no es válido.");
  connection.port = String(port);
  connection.username = encodeURIComponent(environment.PGUSER || "devterminal");
  connection.password = encodeURIComponent(environment.PGPASSWORD || "");
  connection.pathname = `/${encodeURIComponent(environment.PGDATABASE || "devterminal")}`;
  return connection.toString();
}

/** Existing process variables take precedence over the optional local .env. */
export function loadRuntimeEnvironment(root = projectRoot) {
  const envFile = path.join(root, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const databaseUrl = databaseUrlFromEnvironment(process.env);
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
}

export function safeErrorMessage(error) {
  return String(error?.message ?? error)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[conexión PostgreSQL]");
}
