# PostgreSQL replication: Replit primary → Neon replica

Replit PostgreSQL remains the only write authority. Neon is an optional,
one-way replica. The API never writes to Neon as part of a user request; a
database trigger records an outbox event in the same primary transaction, and
the background worker sends committed events later.

## Configuration and safety

- `DATABASE_URL` configures the primary PostgreSQL pool.
- `NEON_DATABASE_URL` configures a separate Neon pool. It is optional and is
  never used as a fallback for `DATABASE_URL`.
- Do not put either URL in source, logs, UI, backups, or command output. Configure
  them through Replit Secrets.
- If Neon is absent or unavailable, primary writes continue. Replication is
  inactive until the one-time baseline is explicitly verified.
- The current replica allowlist is `conversations`, `agents`, `messages`,
  `prompts`, `snippets`, `neural_events`, and `simulation_logs`. Migration
  ledgers, outbox/control data, process state, environment variables, and other
  ephemeral data are not replicated.
- Credential-like strings in row payloads are blocked from replica delivery and
  recorded as failed events using a generic error code. The detector covers
  common key, token, private-key, bearer, and database-URL forms; it is not a
  substitute for keeping secrets out of user-authored content.

## Migrations

Migration histories are recorded independently in each database:

- Primary: `0001_core_persistence`, then `0002_primary_replication_outbox`.
- Neon: `0001_core_persistence`, then `0002_neon_replica_metadata`.

Apply development-primary migrations with
`pnpm --filter @workspace/db run migrate:primary`. The command requires an
explicit development-only flag internally and refuses `NODE_ENV=production`.
Apply Neon migrations
separately with `pnpm --filter @workspace/db run migrate:neon`. The Neon command
requires `NEON_DATABASE_URL`; it never falls back to the primary. Rollbacks are
available as `migrate:primary:down` and `migrate:neon:down` and refuse to remove
replication tables after they contain synchronization data.

Do not run the primary migration CLI against Replit production. Replit-managed
production schema changes use Replit's Publish migration flow; this project
does not publish or apply production migrations automatically.

## Safe initial sync and recovery

1. Apply the corresponding migrations independently to both databases.
2. Run `pnpm --filter @workspace/db run replica:dry-run`. It compares the
   allowlisted table columns, constraints, indexes, per-table row counts, and
   SHA-256 checksums without changing either database. It refuses to claim a
   match if credential-like content is found.
3. To initialize an empty Neon database, or activate an already exact match,
   explicitly run:

   ```sh
   pnpm --filter @workspace/db exec node --experimental-strip-types \
     ./src/replica-admin.ts initialize --confirm-safe-initialize
   ```

   The command locks the seven source/target tables, copies only into a fully
   empty target, verifies checksums, records the verified baseline, then enables
   outbox capture. If Neon contains conflicting data, it exits without changing
   rows. If Neon already matches exactly, it verifies and activates without
   rewriting those rows.
4. Failed transient events retry with bounded exponential backoff (up to eight
   attempts). To manually requeue eligible failures after resolving the cause,
   use:

   ```sh
   pnpm --filter @workspace/db exec node --experimental-strip-types \
     ./src/replica-admin.ts retry-failed --confirm-retry-failed
   ```

Credential-blocked events are not requeued by that command. A later source-row
update after removing the credential-like content creates a new safe event.
`TRUNCATE` is blocked on replicated tables while replication is enabled; use
row deletes so tombstones can be emitted.

The pending queue is capped at 100,000 events. If it reaches the cap, primary
writes continue, but capture pauses and the status changes to
`Requiere reconciliación`; this prevents an unbounded queue and avoids silently
claiming that Neon is current. Do not re-enable from a mismatched dry-run.

## Operational visibility

- `GET /api/readyz` checks primary PostgreSQL connectivity.
- `GET /api/replica-readyz` checks Neon connectivity independently.
- `GET /api/replication/status` reports sanitized pool state, enabled state,
  queue counts, oldest pending-event lag, and last successful replication.
- The DevTerminal header displays the same status. It never shows a database
  host, user, URL, or error message.

The worker uses a primary-side advisory transaction lock so multiple API
processes cannot apply outbox events concurrently. Neon writes, deduplication
records, tombstones, and replica progress updates are committed in one Neon
transaction. If the primary acknowledgement fails after a Neon commit, replay
is safe because the event ID is unique in `replica_applied_events`.
