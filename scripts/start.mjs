import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runMigrations } from "./migrate.mjs";
import { loadRuntimeEnvironment, projectRoot, safeErrorMessage } from "./runtime-env.mjs";

try {
  loadRuntimeEnvironment();
  process.env.NODE_ENV ||= "production";
  process.env.PORT ||= process.env.API_PORT || "3000";
  process.env.HOST ||= "127.0.0.1";
  process.env.DATA_DIR = path.resolve(projectRoot, process.env.DATA_DIR || "data");
  process.env.WORKSPACE_ROOT = path.resolve(projectRoot, process.env.WORKSPACE_ROOT || path.join(process.env.DATA_DIR, "workspace"));
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT debe ser un número entre 1 y 65535.");
  if (!["127.0.0.1", "::1", "localhost"].includes(process.env.HOST) && !process.env.APP_PASSWORD) {
    throw new Error("Configura APP_PASSWORD para escuchar fuera de localhost (HOST). Guarda el valor en .env o en las variables del servidor.");
  }

  const api = path.join(projectRoot, "artifacts/api-server/dist/index.mjs");
  const frontend = path.join(projectRoot, "artifacts/devterminal/dist/public/index.html");
  try {
    await Promise.all([access(api), access(frontend)]);
  } catch {
    throw new Error("Falta la compilación de producción. Ejecuta pnpm build antes de pnpm start.");
  }
  await Promise.all([
    mkdir(process.env.DATA_DIR, { recursive: true }),
    mkdir(process.env.WORKSPACE_ROOT, { recursive: true }),
  ]);
  process.env.NODE_PATH = [
    path.join(process.env.WORKSPACE_ROOT, "node_modules"),
    process.env.NODE_PATH,
  ].filter(Boolean).join(path.delimiter);
  process.env.PATH = [
    path.join(projectRoot, "artifacts/api-server/node_modules/.bin"),
    path.join(projectRoot, "node_modules/.bin"),
    process.env.PATH,
  ].filter(Boolean).join(path.delimiter);
  process.chdir(projectRoot);
  await runMigrations();
  // Import in the same process, preserving the API's signal and WebSocket cleanup.
  await import(pathToFileURL(api).href);
} catch (error) {
  console.error(`[DevTerminal] ${safeErrorMessage(error)}`);
  process.exitCode = 1;
}
