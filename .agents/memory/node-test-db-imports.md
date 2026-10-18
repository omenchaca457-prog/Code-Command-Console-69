---
name: Node test database imports
description: Known limitation when Node's built-in test runner imports the workspace database package directly from TypeScript source.
---

Node 24's built-in ESM test runner fails to import workspace TypeScript packages directly when their barrels contain extensionless imports. This affects both `@workspace/db` and `@workspace/api-zod`; application builds succeed because esbuild bundles the packages.

**Why:** Direct route tests can fail during module linking before reaching the behavior under test. Changing generated workspace package imports just to accommodate the native test runner would broaden the production diff.

**How to apply:** For source-level route tests, inject schema validation and service dependencies, lazy-load default workspace package adapters, and use explicit `.ts` extensions for relative modules imported by the native runner. For direct PostgreSQL integration tests, use the declared `pg` client with parameterized SQL or test through the application bundler.
