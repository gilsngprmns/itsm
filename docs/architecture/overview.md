# Architecture overview

The repository is a pnpm workspace with two deployable applications:

- `apps/web` owns the React/Vite interface, client-side routes, UI state, and
  the centralized HTTP client. It may expose only `VITE_` values to browser
  code; these values are public.
- `apps/api` owns the NestJS REST API, request validation, application
  composition, runtime configuration, and server-side behavior.
- `infrastructure` contains local development infrastructure and scripts.
- `docs` records architecture and operational conventions.

No `packages/contracts` or `packages/config` package is created yet. The API
defines its business DTOs within the relevant feature modules, and there is no
concrete shared schema or tooling abstraction that currently justifies the
maintenance and dependency surface of either package.

The API uses `/api/v1` as its global prefix. The current
`GET /api/v1/health` endpoint is a process liveness check only. PostgreSQL
connectivity is managed by a TypeORM DataSource. `GET /api/v1/health/ready`
executes a lightweight query and reports database readiness separately from
liveness. Schema synchronization and migrations-on-start are disabled.

## Local development

The frontend and API run locally through pnpm, connecting to the existing
`it_db` PostgreSQL database. Docker Compose is an optional alternative for
running PostgreSQL and binds it to loopback; its data persists in the
`postgres-data` named volume.

## Application modules

The API composes authentication, health, user administration, asset catalog,
asset management, ticketing, audit log, and operational reporting modules.
Business endpoints use session-derived permissions, DTO validation, exact-origin checks for
mutations, and PostgreSQL. Asset and ticket assignment, status history, and
audit events are written transactionally. Ticket authorization scopes USER
records to their requester identity, gives AUDIT read-only access, and allows
ticket management to roles with explicit permissions. The React application
exposes role-aware dashboards and permission-gated user, asset, ticket,
report, and audit workflows; the API remains the authorization boundary.
Dashboard aggregations execute in PostgreSQL and reuse the existing audit,
history, ticket, and asset tables. Phase 06/07 does not introduce a migration.
