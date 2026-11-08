# PostgreSQL persistence and backup restore

## Connection configuration

The API reads only `DATABASE_URL`. Add or replace it in Replit Secrets; do not
put it in a source file, `.env` committed to Git, a log, or a chat message. For
Neon, use a newly rotated connection string with `sslmode=require`. The app
normalizes that option to `verify-full` because the installed `pg` parser
currently interprets `require` that way; certificate verification remains on.

If `DATABASE_URL` is absent or invalid, the server still starts in local
development mode. Conversations, terminal messages, and snippets then use
process-local memory and are lost when the process restarts. Database-backed
readiness returns `503`; health liveness remains available. PostgreSQL-backed
features do not silently pretend to be persisted.

The application does not inspect, print, or log the connection string. A
configured secret key alone does not prove the value is valid or that it points
to Neon. Verify `/api/readyz` after configuring it; that endpoint checks a real
`SELECT 1` and returns only a readiness status.

## Migration procedure

The migration is tracked by ID and SHA-256 checksum in
`public.schema_migrations`. It runs in a transaction under an advisory lock,
is safe to run repeatedly, and refuses edited migration contents after they
have been applied. It adds compatible tables, keys, foreign keys, indexes,
sequence defaults, and `updated_at` triggers; it does not truncate or replace
existing rows. It checks for orphan references before adding foreign keys and
does not move an existing sequence backwards.

Before changing a shared database, confirm the target and take a protected
backup using Neon or a secret-aware PostgreSQL tool. Keep the backup outside
the repository. Then run the migration manually:

```sh
pnpm --filter @workspace/db run migrate
```

No schema migration runs automatically at API startup, deploy, or post-merge.
The post-merge setup only installs locked dependencies. Do not use Drizzle
`push`/`push-force` as a substitute for the tracked migration on a populated
database.

Rollback is explicit:

```sh
pnpm --filter @workspace/db run migrate:down
```

The down migration removes only objects it added, and refuses to drop
migration-created tables or newly added keys/sequences when that would risk
existing rows. `schema_migrations` remains as the migration history table.
When rollback is blocked by data, preserve the database and restore a
pre-migration backup to a separate database instead of forcing a drop.

## Supplied backup

The supplied `backup_neuron_quant.sql` contains PostgreSQL `COPY` sections for:

- `conversations(id, title, created_at)`
- `messages(id, conversation_id, role, content, created_at)`
- `snippets(id, title, code, language, created_at, updated_at, last_run_at)`

The parser ignores the dump's DDL, ownership statements, and other SQL. It
validates supported column order, IDs, duplicate IDs, nullability, and message
conversation references. The currently supplied dump has 40 conversations,
120 messages, and 3 snippets; tests verify counts without printing row content.

Restore is a separate, manual operation. First configure a confirmed **new or
empty** database and apply the migration. The importer acquires table locks,
refuses if any of the three core tables contains a row, and inserts the backup
inside one transaction with bound parameters. It preserves IDs and timestamps
and advances sequences without moving them backwards. It never deletes or
updates existing rows.

```sh
pnpm --filter @workspace/db run restore-backup -- --confirm-empty
```

Do not run that command against a populated database. The imported
conversation/message/snippet contents may be sensitive; keep both the source
backup and any exports outside Git and limit access to them. The importer is
not run at startup.

## Application and operational boundaries

- Conversations, messages, and snippets use PostgreSQL when configured. The
  existing AI message routes continue to use the same database tables.
- The local fallback provides CRUD only for the current process; it is not a
  durable substitute for PostgreSQL.
- `/api/healthz` is liveness-only. `/api/readyz` performs a real database
  query, reports readiness, and does not reveal connection details.
- The original terminal UI and `/api/terminal/ws` route are retained. PTY
  execution remains disabled with `503` until authentication and verifiable
  process isolation are available; no server-side shell execution was added.
- The `maquina_4105` Python files were reviewed statically for state-file
  compatibility. The bot was not run and its strategy was not changed. The
  Máquina 4105 panel remains a read-only, paper-trading monitor; there is no
  order execution or wallet access in this persistence change.
