---
name: Node test database imports
description: Known limitation when Node's built-in test runner imports the workspace database package directly from TypeScript source.
---

Node 24's built-in ESM test runner fails to import `@workspace/db` from source because the package barrel and schema modules use extensionless relative directory imports. The application build succeeds because esbuild bundles the workspace package.

**Why:** A database integration test initially failed before it could reach PostgreSQL; broadening the database package import changes just for one test would add unrelated source changes.

**How to apply:** For direct `node --test` PostgreSQL integration tests, use the declared `pg` client with parameterized SQL to verify database constraints, or run the tested code through the application bundler.
