import pg from "pg";
import { createPostgresPoolConfig, readDatabaseUrl } from "./postgres-config.ts";
import { applyMigrations, rollbackLatestMigration } from "./migration-runner.ts";
import { loadMigrations } from "./migrations.ts";

const target = process.argv[2] ?? "primary";
const direction = process.argv[3] ?? "up";
const developmentOnly = process.argv.includes("--development");
if ((target !== "primary" && target !== "neon") || (direction !== "up" && direction !== "down")) {
  process.stderr.write("Usage: node src/migrate.ts <primary|neon> <up|down>\n");
  process.exitCode = 2;
} else {
  let pool: InstanceType<typeof pg.Pool> | undefined;
  try {
    if (target === "primary" && (
      !developmentOnly || process.env.NODE_ENV === "production"
    )) {
      throw new Error("Replit production schema changes are applied through the Publish flow.");
    }
    const databaseUrl = readDatabaseUrl(
      process.env,
      target === "primary" ? "DATABASE_URL" : "NEON_DATABASE_URL",
    );
    if (!databaseUrl) {
      throw new Error(target === "primary"
        ? "Primary PostgreSQL is not configured."
        : "Neon replica is not configured.");
    }

    pool = new pg.Pool(createPostgresPoolConfig(databaseUrl, {
      max: target === "primary" ? 10 : 4,
    }));
    const migrations = await loadMigrations(target);
    if (direction === "up") {
      const applied = await applyMigrations(pool, migrations);
      process.stdout.write(
        applied.length ? `Applied ${target} migrations: ${applied.join(", ")}.\n` : `${target} schema is current.\n`,
      );
    } else {
      const rolledBack = await rollbackLatestMigration(pool, migrations);
      process.stdout.write(
        rolledBack ? `Rolled back ${target} migration ${rolledBack}.\n` : `No ${target} migration is applied.\n`,
      );
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "migration_failed";
    process.stderr.write(
      `Database migration failed (${code}). The connection string was not logged.\n`,
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
