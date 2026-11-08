import assert from "node:assert/strict";
import pg from "pg";
import { describe, it } from "node:test";
import {
  createPostgresPoolConfig,
  DatabaseConfigurationError,
  readDatabaseUrl,
} from "./postgres-config.ts";

describe("PostgreSQL configuration", () => {
  it("uses only DATABASE_URL and supports an unconfigured local mode", () => {
    assert.equal(readDatabaseUrl({}), null);
    assert.equal(
      readDatabaseUrl({
        PGHOST: "ignored.example",
        PGUSER: "ignored",
        PGPASSWORD: "ignored",
      }),
      null,
    );
  });

  it("accepts PostgreSQL URLs but rejects other schemes without echoing the URL", () => {
    assert.equal(
      readDatabaseUrl({ DATABASE_URL: " postgresql://user:secret@db.example/app " }),
      "postgresql://user:secret@db.example/app",
    );
    assert.throws(
      () => readDatabaseUrl({ DATABASE_URL: "https://example.test/private" }),
      (error: unknown) =>
        error instanceof DatabaseConfigurationError
        && !error.message.includes("example.test")
        && !error.message.includes("private"),
    );
  });

  it("normalizes Neon sslmode=require to verified TLS without overriding pg SSL parsing", () => {
    const config = createPostgresPoolConfig(
      "postgresql://sample:sample@db.example.invalid/app?sslmode=require",
    );
    const parsedUrl = new URL(config.connectionString!);
    assert.equal(parsedUrl.searchParams.get("sslmode"), "verify-full");
    assert.equal(config.connectionTimeoutMillis, 5_000);
    assert.equal(config.max, 10);

    const client = new pg.Client(config) as pg.Client & {
      connectionParameters: { ssl: unknown };
    };
    assert.equal(typeof client.connectionParameters.ssl, "object");
    assert.notEqual(client.connectionParameters.ssl, false);
  });
});
