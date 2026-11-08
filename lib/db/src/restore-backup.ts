import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import pg from "pg";
import { createPostgresPoolConfig, readDatabaseUrl } from "./postgres-config.ts";
import { parseCoreBackupCopy } from "./backup-copy.ts";
import { restoreCoreBackupIntoEmptyDatabase } from "./restore-core-backup.ts";

function findWorkspaceRoot(startDirectory: string): string {
  let directory = startDirectory;
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Workspace root was not found.");
    directory = parent;
  }
  return directory;
}

if (!process.argv.includes("--confirm-empty")) {
  process.stderr.write(
    "Restore requires explicit confirmation: add --confirm-empty after verifying the target database is empty.\n",
  );
  process.exitCode = 2;
} else {
  let pool: InstanceType<typeof pg.Pool> | undefined;
  try {
    const databaseUrl = readDatabaseUrl(process.env);
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured.");
    }
    pool = new pg.Pool(createPostgresPoolConfig(databaseUrl));
    const client = await pool.connect();
    try {
      const migration = await client.query(
        "SELECT 1 FROM public.schema_migrations WHERE id = $1",
        ["0001_core_persistence"],
      );
      if (!migration.rows[0]) {
        throw new Error("Apply the database migration before restoring the backup.");
      }
    } finally {
      client.release();
    }

    const root = findWorkspaceRoot(process.cwd());
    const dump = await readFile(join(root, "backup_neuron_quant.sql"), "utf8");
    const parsed = parseCoreBackupCopy(dump);
    const counts = await restoreCoreBackupIntoEmptyDatabase(pool, parsed);
    process.stdout.write(
      `Restored ${counts.conversations} conversations, ${counts.messages} messages, and ${counts.snippets} snippets.\n`,
    );
  } catch (error) {
    const safeMessage =
      error instanceof Error && error.message.startsWith("Restore refused:")
        ? error.message
        : "Backup restore failed. The connection string and row contents were not logged.";
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "restore_failed";
    process.stderr.write(`${safeMessage} (${code})\n`);
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
