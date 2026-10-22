# API conventions

- REST API routes are prefixed with `/api/v1`.
- NestJS controllers own HTTP request/response handling.
- Request DTOs should validate input using `class-validator` and the global
  `ValidationPipe` (`transform`, `whitelist`, and
  `forbidNonWhitelisted` are enabled).
- Add new business logic to feature modules/services rather than controllers.
- Return JSON for successful API responses. Avoid returning stack traces or
  internal configuration.
- `GET /api/v1/health` returns process liveness only.
- `GET /api/v1/health/ready` executes `SELECT 1` through the shared PostgreSQL
  pool. It returns HTTP 503 with a generic payload if the database is
  unavailable.

The frontend centralizes HTTP requests in `apps/web/src/lib/api.ts`. Its
`VITE_API_BASE_URL` is a public build-time value and must never contain secrets.
