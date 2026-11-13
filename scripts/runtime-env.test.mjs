import assert from "node:assert/strict";
import test from "node:test";
import { databaseUrlFromEnvironment, safeErrorMessage } from "./runtime-env.mjs";

test("PostgreSQL variables preserve reserved characters in credentials and database names", () => {
  const environment = { PGHOST: "database", PGPORT: "5544", PGUSER: "test@user", PGPASSWORD: "example:/?#%", PGDATABASE: "project/data" };
  const parsed = new URL(databaseUrlFromEnvironment(environment));
  assert.equal(parsed.hostname, environment.PGHOST);
  assert.equal(parsed.port, environment.PGPORT);
  assert.equal(decodeURIComponent(parsed.username), environment.PGUSER);
  assert.equal(decodeURIComponent(parsed.password), environment.PGPASSWORD);
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), environment.PGDATABASE);
});

test("an explicit database URL takes precedence and missing configuration stays missing", () => {
  const explicit = "postgresql://localhost:5432/example?sslmode=verify-full";
  assert.equal(databaseUrlFromEnvironment({ DATABASE_URL: explicit, PGHOST: "database" }), explicit);
  assert.equal(databaseUrlFromEnvironment({}), undefined);
});

test("IPv6 PGHOST works and invalid hosts or ports are rejected", () => {
  assert.equal(new URL(databaseUrlFromEnvironment({ PGHOST: "::1" })).hostname, "[::1]");
  for (const PGPORT of ["not-a-port", "0", "65536", "1.2"]) {
    assert.throws(() => databaseUrlFromEnvironment({ PGHOST: "database", PGPORT }), /PGPORT/);
  }
  assert.throws(() => databaseUrlFromEnvironment({ PGHOST: "host/path" }), /PGHOST/);
});

test("startup errors redact any embedded PostgreSQL URL", () => {
  const error = new Error("Cannot connect to postgresql://test:example@database:5432/project");
  assert.equal(safeErrorMessage(error), "Cannot connect to [conexión PostgreSQL]");
});
