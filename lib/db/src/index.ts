import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { DatabaseUnavailableError } from "./database-error";
import { createPostgresPoolConfig, readDatabaseUrl } from "./postgres-config";
import { createCorePersistenceStore } from "./persistence";
export { startReplicaWorker, processNextReplicationEvent } from "./replication/replica-worker";
export { inspectReplicationStatus } from "./replication/replication-status";
export type { ReplicationStatus } from "./replication/replication-status";
export { REPLICATED_TABLES } from "./replication/replicated-tables";

const { Pool } = pg;

let configuredUrl: string | null = null;
let configurationState: "postgres" | "missing" | "invalid" = "missing";
let neonUrl: string | null = null;
let neonConfigurationState: "configured" | "missing" | "invalid" = "missing";

try {
  configuredUrl = readDatabaseUrl(process.env);
  if (configuredUrl) configurationState = "postgres";
} catch {
  configurationState = "invalid";
}

try {
  neonUrl = readDatabaseUrl(process.env, "NEON_DATABASE_URL");
  if (neonUrl) neonConfigurationState = "configured";
} catch {
  neonConfigurationState = "invalid";
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
export const neonConfigured = neonConfigurationState === "configured";
export const neonConfigurationStateValue = neonConfigurationState;
export const pool = databaseConfigured
  ? new Pool(createPostgresPoolConfig(configuredUrl!))
  : new UnavailableDatabasePool() as unknown as InstanceType<typeof Pool>;
export const neonPool = neonConfigured
  ? new Pool(createPostgresPoolConfig(neonUrl!, { max: 4 }))
  : null;
export const db = drizzle(pool, { schema });
export const neonDb = neonPool ? drizzle(neonPool, { schema }) : null;
export const corePersistence = createCorePersistenceStore(pool, databaseConfigured);

export * from "./schema";
export { DatabaseUnavailableError } from "./database-error";
export { createCorePersistenceStore } from "./persistence";
export type { CorePersistenceStore, SnippetRecord, TerminalMessageRecord } from "./persistence";
