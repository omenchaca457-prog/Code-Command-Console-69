import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadRuntimeEnvironment, projectRoot, safeErrorMessage } from "./runtime-env.mjs";

const retryableCodes = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "57P03", "53300",
]);

/** Standalone entry point. Reuses the tracked migration history and rollback metadata. */
export async function runMigrations({ target = "primary" } = {}) {
  if (target !== "primary" && target !== "neon") throw new Error("El destino de migración debe ser primary o neon.");
  loadRuntimeEnvironment();
  const [{ applyMigrations }, { loadMigrations }, { readDatabaseUrl, createPostgresPoolConfig }] = await Promise.all([
    import("../lib/db/src/migration-runner.ts"),
    import("../lib/db/src/migrations.ts"),
    import("../lib/db/src/postgres-config.ts"),
  ]);
  const databaseUrl = readDatabaseUrl(process.env, target === "primary" ? "DATABASE_URL" : "NEON_DATABASE_URL");
  if (!databaseUrl) {
    throw new Error(target === "primary"
      ? "Configura DATABASE_URL o PGHOST/PGUSER/PGPASSWORD/PGDATABASE antes de iniciar."
      : "Configura NEON_DATABASE_URL para migrar la réplica opcional.");
  }
  const configuredTimeout = Number(process.env.DATABASE_WAIT_TIMEOUT_MS || "60000");
  if (!Number.isFinite(configuredTimeout) || configuredTimeout < 1000 || configuredTimeout > 300000) {
    throw new Error("DATABASE_WAIT_TIMEOUT_MS debe estar entre 1000 y 300000.");
  }
  const require = createRequire(path.join(projectRoot, "lib/db/package.json"));
  const { Pool } = require("pg");
  const pool = new Pool(createPostgresPoolConfig(databaseUrl, { max: 2 }));
  pool.on("error", () => console.warn("[DB] La conexión de migraciones se interrumpió."));
  try {
    const deadline = Date.now() + configuredTimeout;
    for (;;) {
      try {
        await pool.query("SELECT 1");
        break;
      } catch (error) {
        if (!retryableCodes.has(error.code) || Date.now() >= deadline) throw error;
        console.info("[DB] Esperando PostgreSQL…");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    const applied = await applyMigrations(pool, await loadMigrations(target));
    console.info(applied.length
      ? `[DB] Migraciones ${target}: ${applied.join(", ")}.`
      : `[DB] Esquema ${target} actualizado.`);
    return applied;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runMigrations({ target: process.argv[2] || "primary" }).catch((error) => {
    console.error(`[DB] ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
