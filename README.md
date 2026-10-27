# IT Asset & Service Management

Local IT asset and service management application with a React/Vite frontend,
versioned NestJS API, cookie-based authentication, user and asset administration,
PostgreSQL-backed ticketing, audit trail, and operational dashboards.

## Prerequisites

- Node.js 22.12 or newer (Node.js 24 recommended)
- pnpm 10.12.1
- PostgreSQL running locally with a database named `it_db`

On Windows, if PowerShell blocks the `pnpm.ps1` shim, use `pnpm.cmd`.

## Local setup

From the repository root, copy `.env.example` to `.env` and set
`DATABASE_URL` to match your local PostgreSQL username and password. The
example assumes user `postgres`, host `127.0.0.1`, port `5432`, and database
`it_db`. Keep the real password only in `.env`, which is ignored by Git. Then
run:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

`pnpm.cmd dev` starts the frontend at <http://localhost:5173> and the API at
<http://localhost:3000>. The API health endpoint is
<http://localhost:3000/api/v1/health>. The frontend reads
`VITE_API_BASE_URL` from the root `.env` at build/start time; this is a public
browser URL, not a secret. Vite exposes all variables with the `VITE_` prefix
to browser code. `DATABASE_URL`, session configuration, and database
credentials are server-only and must not use the `VITE_` prefix. Production
requires explicitly configured HTTPS `CORS_ORIGINS`. The API attempts a
PostgreSQL connection during startup. If PostgreSQL is unavailable, the API
still serves liveness while readiness returns HTTP 503; it retries database
connection on subsequent readiness checks.

Before login, create the initial administrator using
`pnpm.cmd --filter api auth:bootstrap-admin` from an interactive terminal.
The command prompts for credentials and only bootstraps when there is no active
ADMIN account. Keep the password private.

Docker Compose remains an optional way to run a separate local PostgreSQL
instance; it is not needed when using your existing PostgreSQL installation.

To check or start a locally installed PostgreSQL Windows service, use an
elevated PowerShell terminal when required:

```powershell
Get-Service *postgres*
Start-Service postgresql-x64-18
```

Use the actual service name returned on your machine if it differs. Verify the
configured database before applying a migration:

```powershell
pnpm.cmd db:migration:show
```

Create and verify a backup before a schema change, review the migration SQL,
and confirm the configured target is `it_db`. Then build and run the reviewed
migration explicitly:

```powershell
pnpm.cmd --filter api build
pnpm.cmd db:migration:run
pnpm.cmd db:migration:show
```

Verify liveness/readiness at `http://localhost:3000/api/v1/health` and
`http://localhost:3000/api/v1/health/ready`. Ticket APIs require a signed-in
user with the relevant permission. Unit tests use mocked database access. The opt-in PostgreSQL integration check
is read-only and verifies only the isolated database connection and expected
schema; it does not exercise business writes. Domain-level PostgreSQL
integration tests remain blocked until a dedicated database with a reviewed,
repeatable schema and fixture setup is available. Never use `it_db` as a test
fixture.

After signing in, open `http://localhost:5173/dashboard`. ADMIN and AUDIT
accounts with `reports.read` see operational summaries; USER accounts see
their own ticket list and currently assigned assets. The `/reports` and
`/audit-logs` pages require `reports.read` and `audit.read`, respectively.
These APIs use PostgreSQL data and existing role permissions; Phases 06-08 add
no database migration.

## Development commands

| Command                                  | Purpose                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `pnpm.cmd dev`                           | Start frontend and API in parallel                               |
| `pnpm.cmd dev:web`                       | Start only the Vite frontend                                     |
| `pnpm.cmd dev:api`                       | Start only the NestJS API                                        |
| `pnpm.cmd build`                         | Build all workspace applications                                 |
| `pnpm.cmd lint`                          | Run ESLint in each application                                   |
| `pnpm.cmd format:check`                  | Check formatting without modifying files                         |
| `pnpm.cmd typecheck`                     | Run strict TypeScript checks                                     |
| `pnpm.cmd test`                          | Run workspace unit tests (no live DB writes)                     |
| `pnpm.cmd --filter api test:integration` | Run the opt-in, read-only PostgreSQL schema smoke test           |
| `pnpm.cmd audit`                         | Audit production dependencies                                    |
| `pnpm.cmd db:migration:show`             | Show discovered migrations and verify source consistency         |
| `pnpm.cmd db:migration:run`              | Run reviewed TypeORM migrations (build API first)                |
| `pnpm.cmd db:migration:revert`           | Revert the latest migration only when its down operation is safe |

To use Docker instead of an installed PostgreSQL, run
`docker compose up -d postgres`. Its data persists in the `postgres-data`
volume; `docker compose down` stops it without deleting data.

## Troubleshooting

- If the API cannot connect to PostgreSQL, make sure the service is running,
  database `it_db` exists, and the username, password, host, and port in
  `DATABASE_URL` are correct.
- If your PostgreSQL user or port differs from the example, update
  `DATABASE_URL` in `.env`; URL-encode special characters in the password.
- If the API health endpoint cannot be reached, confirm the API process started
  and that `PORT` is available.
- If PowerShell refuses `pnpm`, invoke `pnpm.cmd` rather than changing the
  machine's execution policy.

## Current limitations

- `GET /api/v1/health` is liveness. `GET /api/v1/health/ready` performs
  `SELECT 1` and reports database readiness.
- The existing `it_db` schema is inspected and has 26 tables. The additive
  ticket migration is recorded in TypeORM migration history.
- TypeORM is configured with schema synchronization and automatic migrations
  disabled. Review new migrations and back up affected data before applying.
- Run the administrator bootstrap command only if an initial active ADMIN
  account is actually needed; the script refuses to create another when one
  already exists.
- Audit events are recorded for authentication and business mutations in the
  existing `audit_logs` table. The read-only `GET /api/v1/audit-logs` endpoint
  requires `audit.read`; report endpoints require `reports.read`.
- Operational reports use live PostgreSQL aggregations. Ticket report date
  ranges use inclusive `startDate` and `endDate` calendar days; asset inventory
  summaries represent the current inventory.
- Ticket assignments are restricted to users with `tickets.update`; the
  existing roles do not include a dedicated support role.
- Ticket attachment uploads, SLA automation, notifications, and ticket-specific
  request throttling are not implemented.
- The security configuration is a development baseline, not a production
  readiness claim.

## Backup, restore, and release rollback

Before a reviewed schema change, use the backup and verification procedure in
[database operations](docs/database/README.md#backup-before-approved-schema-changes).
Keep backups outside the repository with access restricted; a database backup
may contain personal or confidential records.

No production deployment or restore test has been performed. A restore must
target a separately verified, isolated database, never `it_db`. The Phase 05
migration's down operation removes the added ticket columns; do not use it as
an automatic rollback after those columns have been populated. Prefer rolling
back application code while preserving the schema, or use a reviewed
forward-only database correction. Any restore or destructive rollback requires
explicit owner approval and a verified backup.

Before a controlled future deployment, validate the runtime and HTTPS/CORS
configuration, apply only reviewed migrations to the intended environment,
check liveness and readiness, and smoke-test authentication, role restrictions,
ticket/asset workflows, audit access, and reports. Keep the prior application
build available for application rollback. Production backup recovery,
deployment, and migration rollback remain unverified.

See [architecture overview](docs/architecture/overview.md),
[database setup](docs/database/README.md), and
[security baseline](docs/security/baseline.md).
