import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { DatabaseUnavailableError } from "./database-error";
import { createPostgresPoolConfig, readDatabaseUrl } from "./postgres-config";
import { createCorePersistenceStore } from "./persistence";

const { Pool } = pg;

let configuredUrl: string | null = null;
let configurationState: "postgres" | "missing" | "invalid" = "missing";

try {
  configuredUrl = readDatabaseUrl(process.env);
  if (configuredUrl) configurationState = "postgres";
} catch {
  configurationState = "invalid";
}

class UnavailableDatabasePool {
  query(): Promise<never> {
    return Promise.reject(new DatabaseUnavailableError());
  }

  connect(): Promise<never> {
    return Promise.reject(new DatabaseUnavailableError());
  }

  on(): this {
    return this;
  }

  end(): Promise<void> {
    return Promise.resolve();
  }
}

export const databaseConfigured = configurationState === "postgres";
export const databaseConfigurationState = configurationState;
export const pool = databaseConfigured
  ? new Pool(createPostgresPoolConfig(configuredUrl!))
  : new UnavailableDatabasePool() as unknown as InstanceType<typeof Pool>;
export const db = drizzle(pool, { schema });
export const corePersistence = createCorePersistenceStore(pool, databaseConfigured);

export * from "./schema";
export { DatabaseUnavailableError } from "./database-error";
export { createCorePersistenceStore } from "./persistence";
export type { CorePersistenceStore, SnippetRecord, TerminalMessageRecord } from "./persistence";
