---
name: PostgreSQL replication direction
description: The project's primary database, optional Neon replica, and safe activation boundary.
---

Replit PostgreSQL is the sole source of truth. Neon is an optional downstream replica; application writes never flow from Neon back to Replit. A replica must not be considered synchronized until its schema and table checksums have been verified against the primary.

**Why:** the user explicitly required one-way replication, no automatic overwrite of existing Neon data, and no dependency on Neon for primary writes.

**How to apply:** keep `DATABASE_URL` as the primary pool and `NEON_DATABASE_URL` as an independent optional pool. Require an explicit safe baseline before enabling replication. If the replica diverges or the bounded outbox requires a rebaseline, report the mismatch and wait for an explicit repair decision rather than overwriting data automatically.
