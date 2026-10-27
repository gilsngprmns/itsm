# Security baseline

This is a local-development and internal-testing baseline, not a production
security certification.

## Implemented controls

- Root `.env` and other local environment files are ignored; `.env.example`
  contains development-safe placeholders. `VITE_` variables are public browser
  configuration and must never contain server credentials.
- API startup validates the PostgreSQL URL, port, session settings, and
  explicit CORS origins. Development/test may default to localhost; production
  requires configured HTTPS origins and fails closed when they are missing.
- CORS allows credentials for the HttpOnly cookie session and restricts
  browsers to the configured origin allowlist. State-changing endpoints require
  an exact allowed `Origin`; cross-site Fetch Metadata is rejected.
- Sessions use cryptographically random opaque tokens, persist only a
  SHA-256 token hash in PostgreSQL, and enforce expiry, revocation, and active
  account status. Cookies are HttpOnly, SameSite=Strict, scoped to `/api/v1`,
  and Secure in production.
- Passwords use Argon2id. Login failures use generic credential messages,
  per-account lockout and per-IP throttling. Passwords, hashes, and session
  tokens are not included in application audit events or API responses.
- pnpm build scripts remain restricted; only `argon2` is allowlisted in
  `pnpm-workspace.yaml`. CI explicitly rebuilds that package and verifies
  hash/verify behavior. A clean remote runner result remains pending.
- Roles and permissions are loaded from the database on authenticated
  requests. Protected routes enforce permissions in the API; user-owned
  tickets and assigned-asset access are scoped server-side. AUDIT permissions
  remain read-only for the implemented business workflows.
- Global DTO validation transforms known fields, rejects unknown fields, and
  enforces endpoint-specific length, enum, date, identifier, and pagination
  constraints. SQL values are parameterized; selected sort columns are
  allowlisted. React renders user-entered text as text rather than HTML.
- Helmet applies HTTP security headers. A validated or generated request ID is
  returned in `X-Request-Id`, recorded with audit events, and included in
  unexpected-error logs. Errors returned to clients do not reveal internal
  exception details.
- PostgreSQL schema synchronization and automatic migrations are disabled.
  Ticket, asset, user, and audit writes use explicit transactions where
  required. Readiness performs a lightweight `SELECT 1`; liveness does not
  expose database details.
- CI is configured to run lint, formatting checks, typechecking, unit tests,
  PostgreSQL integration tests, production dependency audit, Argon2 smoke
  verification, and builds. A remote GitHub Actions run has not yet been
  observed.

## Remaining risks and limits

- The API is bound to loopback for local development. Any hosted deployment
  needs an explicitly reviewed network/reverse-proxy and TLS configuration.
- There is no tested production secret manager, database TLS policy,
  least-privilege runtime database role, centralized log/alert service, or
  audit-log retention/immutability policy.
- Unit tests use mocked database access. The isolated PostgreSQL integration
  suite verifies migration order, schema essentials, seeded role permissions,
  real report aggregates/date boundaries under UTC and non-UTC PostgreSQL
  session timezones, asset/ticket service writes and view semantics, and
  controlled migration failure rollback. Authenticated HTTP integration tests
  exercise login, role and object authorization, asset and ticket workflows,
  reports, audit history, and CSV preview/import validation including rejected
  batches and upload limits. Never point tests at the developer database to
  compensate.
- Backup/restore and application/database rollback procedures are documented
  but have not been restore-tested in an isolated environment.
- Ticket attachment upload, SLA automation, notifications, and ticket-specific
  throttling are not implemented.
- Dependency audit results do not establish that the application is free of
  vulnerabilities. Reassess dependencies and deployment configuration before
  staging or production.

## Local security checks

From the repository root on Windows:

```powershell
pnpm.cmd lint
pnpm.cmd format:check
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd audit
```

Do not publish `.env`, database backups, session cookies, or credentials in
issue reports or logs. Rotate an exposed secret through the owner-approved
secret-management process; do not commit replacement credentials.
