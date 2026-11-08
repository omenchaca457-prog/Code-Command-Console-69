import pg from "pg";
import { createPostgresPoolConfig, readDatabaseUrl } from "./postgres-config.ts";
import { applyMigrations, rollbackLatestMigration } from "./migration-runner.ts";
import { loadMigrations } from "./migrations.ts";

const direction = process.argv[2] ?? "up";
if (direction !== "up" && direction !== "down") {
  process.stderr.write("Usage: pnpm --filter @workspace/db run migrate [up|down]\n");
  process.exitCode = 2;
} else {
  let pool: InstanceType<typeof pg.Pool> | undefined;
  try {
    const databaseUrl = readDatabaseUrl(process.env);
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured.");
    }

    pool = new pg.Pool(createPostgresPoolConfig(databaseUrl));
    const migrations = await loadMigrations();
    if (direction === "up") {
      const applied = await applyMigrations(pool, migrations);
      process.stdout.write(
        applied.length ? `Applied ${applied.join(", ")}.\n` : "Database schema is current.\n",
      );
    } else {
      const rolledBack = await rollbackLatestMigration(pool, migrations);
      process.stdout.write(
        rolledBack ? `Rolled back ${rolledBack}.\n` : "No migration is applied.\n",
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
