# Local PostgreSQL setup and migration policy

The API connects to the existing local PostgreSQL database named `it_db`.
Read-only inspection verified PostgreSQL 18.4 at `127.0.0.1:5432` using the
local `.env` credentials. The target remains `it_db`; do not switch it to
`itsm_db`.

## Local connection

1. Ensure PostgreSQL is running and database `it_db` exists.
2. Copy `.env.example` to `.env` if the local file does not exist.
3. Set `DATABASE_URL` to the local PostgreSQL username/password, host, port,
   and `it_db` database. Keep the real credentials in `.env` only.
4. Start the API with `pnpm.cmd dev:api` on Windows.

The backend loads the root `.env` consistently from both source and compiled
application paths. If PostgreSQL is unavailable, the API stays live and the
readiness endpoint returns HTTP 503; readiness attempts to reconnect later.
Errors log only a database error code, never connection credentials.

The API uses TypeORM 0.3 with the PostgreSQL `pg` driver and a pooled
DataSource. Connection timeout is limited to five seconds and query statement
timeout to three seconds. `GET /api/v1/health` is liveness;
`GET /api/v1/health/ready` runs `SELECT 1` through the pool.

The root `.env` is server-side configuration. `DATABASE_URL`,
`SESSION_COOKIE_NAME`, and `AUTH_SESSION_TTL_MINUTES` must never be exposed
through frontend `VITE_` variables. `VITE_API_BASE_URL` is intentionally public
and identifies the API origin. Production must set `NODE_ENV=production` and
an explicit comma-separated `CORS_ORIGINS` list using HTTPS origins; startup
rejects a missing production allowlist or HTTP origin. Local development may
use `http://localhost:5173`.

## Authentication and initial administrator

Authentication reuses the existing `users`, `roles`, `permissions`,
`user_roles`, `role_permissions`, `refresh_tokens`, and `audit_logs` tables.
It does not enable schema synchronization or apply a migration. Session
cookies are HttpOnly, SameSite=Strict, scoped to `/api/v1`, and Secure in
production. The API-wide cookie path is required so authenticated requests to
reports, tickets, assets, and other API modules carry the session. On login,
the API also clears the previous `/api/v1/auth` cookie path for sessions
created by older builds. The browser does not store the session token in local
or session storage. The API stores only a SHA-256 token hash in
`refresh_tokens`, enforces account and IP login limits, and derives
permissions from database role assignments.

The endpoints are:

- `POST /api/v1/auth/login` — accepts an email and password and sets the
  session cookie.
- `POST /api/v1/auth/logout` — revokes the current cookie session.
- `GET /api/v1/auth/me` — returns the current user, roles, and permissions.
- `GET /api/v1/admin/access-check` — example route requiring `users.read`.

For local development, set `CORS_ORIGINS` to the exact frontend origin (by
default `http://localhost:5173`). State-changing auth requests also require a
matching `Origin`. Use HTTPS in production.

## User and asset administration

Phase 04 adds authenticated endpoints for user administration, asset
categories, locations, assets, assignments, and lifecycle history. These
features use the existing `users`, `roles`, `user_roles`, `asset_categories`,
`locations`, `assets`, `asset_assignments`, `asset_status_history`, and
`audit_logs` tables. No migration or schema synchronization is needed or
performed for these endpoints.

All routes require a valid session and their documented permission. Mutating
routes additionally require an exact allowed `Origin`:

| Route                                                                    | Permission         | Purpose                                      |
| ------------------------------------------------------------------------ | ------------------ | -------------------------------------------- |
| `GET /api/v1/users`, `GET /api/v1/users/:id`                             | `users.read`       | Search, paginate, and view users             |
| `POST /api/v1/users`                                                     | `users.create`     | Create a user with an initial password       |
| `PATCH /api/v1/users/:id`                                                | `users.update`     | Update user details                          |
| `PATCH /api/v1/users/:id/status`                                         | `users.deactivate` | Activate or deactivate an account            |
| `PATCH /api/v1/users/:id/role`                                           | `roles.manage`     | Set a user's role                            |
| `GET /api/v1/asset-categories`, `GET /api/v1/locations`                  | `assets.read`      | List asset catalog values                    |
| `POST` or `PATCH` on `/api/v1/asset-categories` and `/api/v1/locations`  | `assets.update`    | Create, update, or deactivate catalog values |
| `GET /api/v1/assets`, `GET /api/v1/assets/:id`, and asset history routes | `assets.read`      | Search assets and view details/history       |
| `POST /api/v1/assets`                                                    | `assets.create`    | Create an asset                              |
| `PATCH /api/v1/assets/:id` and `PATCH /api/v1/assets/:id/status`         | `assets.update`    | Update asset details or lifecycle status     |
| `POST /api/v1/assets/:id/assignments` and `/release`                     | `assets.assign`    | Assign, reassign, or release an asset        |

New users receive the existing `USER` role by default. The creator must supply
an initial password; only its Argon2id hash is stored. Deliver that initial
password out of band. A password-reset or forced-first-login workflow is not
implemented. Deactivation revokes active refresh tokens. Role/status changes
protect the last active administrator, and users cannot change their own role
or deactivate their own account.

`ADMIN` and `AUDIT` users with `assets.read` can view all assets. Other users
see only assets currently assigned to them. Users without permission to
manage/view users receive redacted assignee identities in assignment history;
audit-only user views omit email, phone, and employee code.

Valid asset statuses are `AVAILABLE`, `ASSIGNED`, `IN_REPAIR`, `DAMAGED`,
`LOST`, `RETIRED`, and `DISPOSED`. Assignment and release operations control
the `ASSIGNED` state; direct status updates cannot set it. Reassignment closes
the previous open assignment and creates the new assignment in one
transaction. Release closes the open assignment and returns the asset to
`AVAILABLE`. Lifecycle changes are checked against the allowed transition
table, and transactional writes record audit and status-history entries.
Categories and locations are deactivated rather than physically deleted.

## Ticketing

Phase 05 implements ticket creation, scoped listing and detail reads, status
transitions, assignments, comments, status/assignment history, and ticket
category management using the pre-existing ticket tables in `it_db`. The
existing eight active ticket categories are preserved; no category seed is
run or overwrites existing values. Ticket attachments and SLA automation are
not implemented.

The deployed role permissions are reused without adding roles:

- `ADMIN` can read all tickets, create/update, assign, comment, manage
  categories, and add internal notes.
- `USER` can create tickets, read only tickets they requested, and comment on
  their own tickets. The requester is always taken from the authenticated
  session.
- `AUDIT` can read all tickets and public comments/history, but cannot mutate
  tickets or view internal notes.

There is no dedicated support role. Ticket assignment is restricted to active
users whose database-derived permissions include `tickets.update`; with the
current role mappings this is the ADMIN role only. The API never treats every
USER as support staff.

Ticket states are `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`, and
`CANCELLED`. Allowed transitions are:

- `OPEN` to `IN_PROGRESS` or `CANCELLED`
- `IN_PROGRESS` to `PENDING`, `RESOLVED`, or `CANCELLED`
- `PENDING` to `IN_PROGRESS` or `RESOLVED`
- `RESOLVED` to `CLOSED` or `IN_PROGRESS` (admin reopen)
- `CLOSED` and `CANCELLED` are terminal

Resolving requires a resolution summary. Closed/cancelled tickets cannot be
edited, assigned, or commented on. Reassignment and status changes write
history and audit records in the same transaction. Internal notes are filtered
in the API service query and are returned only to users with `tickets.update`.
Ticket descriptions and comments are rendered as text, not HTML.

API routes are protected by session and permission guards; mutating routes
also use the exact-origin guard:

| Route                                                                                 | Permission                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET /api/v1/tickets`, `GET /api/v1/tickets/:id`                                      | `tickets.read.all` or `tickets.read.own` |
| `POST /api/v1/tickets`                                                                | `tickets.create`                         |
| `PATCH /api/v1/tickets/:id` and `/status`                                             | `tickets.update`                         |
| `PATCH /api/v1/tickets/:id/assignment`, `GET /api/v1/tickets/assignees`               | `tickets.assign`                         |
| `GET /api/v1/tickets/:id/comments`, `/history`                                        | `tickets.read.all` or `tickets.read.own` |
| `POST /api/v1/tickets/:id/comments`                                                   | `tickets.comment`                        |
| `GET /api/v1/ticket-categories`                                                       | `tickets.read.all` or `tickets.read.own` |
| `POST /api/v1/ticket-categories`, `PATCH /api/v1/ticket-categories/:id` and `/status` | `tickets.update`                         |

Search, filters, sorting, and pagination are applied in PostgreSQL. Requester
filters are restricted to users with `tickets.read.all`. No attachment upload
or ticket-specific request rate limiting is included.

## Audit trail and operational reports

The existing `audit_logs` table and business mutation audit writes are reused;
Phase 06 does not add a migration or alter stored records. Authentication
success/failure, logout, access denial, user/role changes, asset and catalog
mutations, ticket lifecycle/assignment/comment events are recorded by the API.
Business updates and their audit writes share a database transaction where
they belong to the same mutation. This is application-level traceability, not
a claim that database administrators cannot alter records.

Audit and reporting endpoints reuse the database-derived permission guard:

| Route                          | Required permission | Purpose                                                  |
| ------------------------------ | ------------------- | -------------------------------------------------------- |
| `GET /api/v1/audit-logs`       | `audit.read`        | Filtered, paginated global event list                    |
| `GET /api/v1/reports/overview` | `reports.read`      | Ticket and asset summaries, trends, recent activity      |
| `GET /api/v1/reports/tickets`  | `reports.read`      | Ticket status, priority, category, trend, resolved count |
| `GET /api/v1/reports/assets`   | `reports.read`      | Current asset status, category, and location summaries   |
| `GET /api/v1/reports/activity` | `reports.read`      | Recent audit event summaries                             |

ADMIN and AUDIT are the existing roles with `audit.read` and `reports.read`.
USER cannot access global audit logs or operational reports. Audit responses
do not serialize stored before/after JSON, request IP addresses, user agents,
or request IDs. Report ticket date filters are inclusive calendar dates, with
the end date implemented as an exclusive next-day database boundary. Ticket
counts are based on creation date; resolved counts use resolution time. Asset
summaries are current inventory and are not filtered by ticket date range.

To create the first administrator, run
`pnpm.cmd --filter api auth:bootstrap-admin` in an interactive terminal. The
command is restricted to the `it_db` database configured in the root `.env`,
prompts for the name/email, and reads the password without echoing it. It
creates an account only if there is no active ADMIN role assignment and commits
the user, role assignment, and audit event in one transaction. Do not run it
unless you intend to create the initial administrator; it has not been run as
part of this implementation.

## Existing schema inspection

The initial schema inspection was read-only. Phase 05 additionally inspected
ticket-table metadata, category names/statuses, role permissions, and row
counts; it did not read ticket or comment bodies. The database contains:

- PostgreSQL 18.4 at `127.0.0.1:5432`.
- The `public` application schema with 26 existing base tables.
- 26 primary-key constraints, 48 foreign-key constraints, and 75 indexes.
- The `pgcrypto` and `plpgsql` extensions.
- Pre-existing `tickets`, `ticket_categories`, `ticket_comments`,
  `ticket_status_history`, `ticket_assignments`, `ticket_attachments`, and
  `ticket_sla_policies` tables and `tickets_ticket_number_seq`.
- Ticket, comment, assignment, status-history, and attachment tables had no
  rows; 8 active categories and 4 SLA policy rows already existed.
- Existing `ADMIN`, `USER`, and `AUDIT` roles already had ticket permissions.
- No TypeORM/Prisma/Knex/Sequelize/Drizzle migration-history table.

No existing tables are dropped or recreated. TypeORM schema synchronization
remains disabled and migrations are not run on startup. The Phase 05 migration
adds nullable `location_id` and `resolution_summary` columns to `tickets`, a
restricting location foreign key and location index, and aligns the existing
identity sequence to the highest stored ticket number. It preserves the
existing identity configuration and does not overwrite category/policy rows or
existing ticket data. Running the migration creates a TypeORM
migration-history table because none existed before this phase.

## ORM and migration strategy

TypeORM 0.3 was selected for its NestJS/PostgreSQL integration and explicit
migration tooling. The live database has no historical migration records, so
the ticket migration is deliberately additive and scoped to the already
existing ticket schema; it is not presented as a baseline migration for the
other tables. Review `apps/api/src/database/migrations` before applying it.
Do not generate a full initial migration from an empty entity model.

Inspect whether migration history exists and, if present, list applied
migrations. This repository command reads catalog/table data only and does not
create a migration metadata table:

```powershell
pnpm.cmd db:migration:show
```

Only after a migration is reviewed and a backup is verified, migrations can be
run explicitly:

```powershell
pnpm.cmd db:migration:run
```

`migration:run` is not run during app startup. It can create TypeORM migration
metadata as part of applying migrations. Do not use schema synchronization.

## Isolated integration-test database

Default unit tests use mocked PostgreSQL access and never write to a database.
The opt-in schema smoke test requires an explicitly configured
`TEST_DATABASE_URL` and rejects all targets except the loopback PostgreSQL
database named `it_db_phase09_test`. It does not read the root `DATABASE_URL`,
run migrations, synchronize schema, or write database rows.

Run it from PowerShell only after an owner has reviewed and provisioned the
isolated database and its schema:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://<test-user>:<test-password>@127.0.0.1:5432/it_db_phase09_test'
pnpm.cmd --filter api test:integration
Remove-Item Env:TEST_DATABASE_URL
```

The URL must point to a local loopback host and the exact dedicated database
name; the test fails before connecting when the value is absent, targets
`it_db`, or points to a remote host. Do not place the URL in a `VITE_`
variable, source control, or command output.

At the time of Phase 09 audit, `it_db_phase09_test` did not exist and the repo
has no complete baseline schema migration or deterministic fixture loader.
The integration command is therefore **BLOCKED** until the owner provisions a
dedicated database from a reviewed schema snapshot and creates isolated
fixtures. Do not derive and restore the schema automatically from `it_db`;
review its impact and provenance first. The available test only verifies
database identity and presence of domain tables—it does not yet test user,
asset, ticket, transaction, or report CRUD against PostgreSQL.

Never add automatic `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, or migration
commands to the integration runner. If a reusable schema baseline and fixture
workflow is approved later, migrations and CRUD tests must target only
`it_db_phase09_test`, with the same database-name and loopback safeguards.

## Read-only schema inspection

On Windows, `psql` will prompt for the password:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d it_db -W -c "\dt+"
```

Inspect one table with `\d+ public.table_name`. Prefer schema metadata to
querying or sharing application row contents.

## Backup before approved schema changes

Create a custom-format backup before any approved migration. `-W` prompts for
the password instead of putting it in command history:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h 127.0.0.1 -p 5432 -U postgres -W -Fc -f .\it_db-before-migration.dump it_db
```

Store the backup securely outside source control and verify that its archive
can be read:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --list .\it_db-before-migration.dump
```

This archive-list check does not prove that the backup can be restored.
Recovery verification, if approved, must use a separately verified and
isolated target such as `it_db_restore_test`, never the development `it_db`.
First confirm that the target name is unused:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -W -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'it_db_restore_test'"
```

Only if that query returns no row, and an owner has approved creating the
isolated test database, restore without dropping existing objects:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 5432 -U postgres -W it_db_restore_test
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' -h 127.0.0.1 -p 5432 -U postgres -W --exit-on-error --no-owner --no-privileges -d it_db_restore_test .\it_db-before-migration.dump
```

These restore commands are documentation only and have not been run. Do not
use `--clean`, `--create`, or `--dbname it_db` for a recovery test. Remove an
isolated test database only after separately verifying its exact name, contents,
and approval; no cleanup is part of the normal test workflow.

For application rollback, redeploy the previous application build while
preserving additive schema changes. Review each migration's `down` operation:
the Phase 05 down migration drops ticket columns and would discard data written
to those columns. Do not run it as a routine rollback after deployment. Prefer
a forward corrective migration; restore only to an isolated database unless
the owner explicitly approves recovery actions.

Production deployment, database restore, and rollback have not been tested.
Do not describe a backup as recoverable until an isolated restore test succeeds.

Docker Compose is optional and starts a separate PostgreSQL instance; it does
not manage or replace the existing `it_db`. Validating Compose configuration
does not prove PostgreSQL is running.
