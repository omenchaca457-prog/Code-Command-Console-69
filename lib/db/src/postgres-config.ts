import type { PoolConfig } from "pg";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL must be a valid PostgreSQL connection URL.");
    this.name = "DatabaseConfigurationError";
  }
}

export function readDatabaseUrl(
  environment: Record<string, string | undefined>,
): string | null {
  const value = environment.DATABASE_URL?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error("Unsupported database protocol");
    }
  } catch {
    throw new DatabaseConfigurationError();
  }

  return value;
}

export function createPostgresPoolConfig(databaseUrl: string): PoolConfig {
  const validatedUrl = readDatabaseUrl({ DATABASE_URL: databaseUrl });
  if (!validatedUrl) throw new DatabaseConfigurationError();

  const normalizedUrl = new URL(validatedUrl);
  if (normalizedUrl.searchParams.get("sslmode")?.toLowerCase() === "require") {
    // The installed pg parser currently treats `require` as verify-full and
    // warns this alias will change in its next major. Make that secure,
    // Neon-compatible behavior explicit without supplying an overriding ssl
    // object or weakening certificate validation.
    normalizedUrl.searchParams.set("sslmode", "verify-full");
  }

  // Keep TLS mode in the connection URL. Supplying a separate `ssl` option
  // alongside connectionString can override node-postgres URL parsing.
  return {
    connectionString: normalizedUrl.toString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  };
}
