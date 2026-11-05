# Deploying the monorepo to Vercel

The repository is a pnpm workspace with two independent Vercel projects. Use
the same Git repository and create one Vercel project for each application.
Vercel's current NestJS runtime detects the API entry point at
`apps/api/src/main.ts` and serves it as a Node.js Function; the application
continues to use its existing Nest bootstrap and `/api/v1` global prefix.
There is no custom serverless adapter and no database migration is run at
build time or during function startup.

## Frontend project

Set the project options in Vercel:

- **Root Directory:** `apps/web`
- **Framework Preset:** Vite
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist`
- **Install Command:** use the detected pnpm workspace install command, or
  `pnpm install --frozen-lockfile`
- **Environment variable:** `VITE_API_BASE_URL`, set to the backend's public
  origin plus `/api/v1` (for example, `https://api.example.com/api/v1`).

The frontend's [vercel.json](../../apps/web/vercel.json) rewrites application
routes to `index.html`, so React Router deep links continue to work after a
refresh. Vite's `127.0.0.1:3000` proxy is for local development only and is
not used in the production build.

Vite variables are embedded in the built client and are public. Never put
database URLs, passwords, session secrets, or other credentials in a `VITE_`
variable.

## Backend project

Set the second Vercel project to the same Git repository:

- **Root Directory:** `apps/api`
- **Framework Preset:** NestJS, when offered by the project settings
- **Build Command:** `pnpm run build` (or Vercel's NestJS default)
- **Install Command:** use the detected pnpm workspace install command, or
  `pnpm install --frozen-lockfile`
- **Node.js Version:** 24.x, which satisfies the repository's Node.js
  `>=22.12.0` requirement and matches the CI runtime.
- Vercel's current zero-configuration NestJS support requires Vercel CLI
  48.4.0 or newer when deploying with the CLI.

Do not add an API rewrite or a second global prefix. The Nest application
already exposes routes beneath `/api/v1`, including `/api/v1/health` and
`/api/v1/health/ready`. Vercel's NestJS framework integration handles requests
through `src/main.ts`; it is not a long-running `node dist/main.js` server.

## Production environment variables

Set values in the **backend** Vercel project's environment settings, not in
the frontend project:

| Variable                                                                 | Requirement                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `NODE_ENV`                                                               | Required by the application validator; set to `production`.    |
| `DATABASE_URL`                                                           | Required PostgreSQL URL. Use the existing Neon production      |
| database's pooled connection string where available. Do not copy it into |
| this document or the frontend project.                                   |
| `CORS_ORIGINS`                                                           | Required in production. Exact comma-separated HTTPS            |
| frontend origins only; wildcards are rejected.                           |
| `PUBLIC_WEB_URL`                                                         | Optional HTTPS frontend origin, used when generating           |
| asset links.                                                             |
| `SESSION_COOKIE_NAME`                                                    | Optional; defaults to `itsm_session`.                          |
| `AUTH_SESSION_TTL_MINUTES`                                               | Optional; defaults to `480`; accepted range is                 |
| 5–1440.                                                                  |
| `PORT`                                                                   | Optional; defaults to `3000`. Vercel manages function routing. |

Set `VITE_API_BASE_URL` in the **frontend** project's Production environment
to the backend origin and `/api/v1`, then redeploy the frontend whenever that
value changes. Preview deployments need their own explicit API URL and the
matching preview frontend origin in the backend's `CORS_ORIGINS`; no wildcard
origins are supported.

The API disables dotenv file loading in Vercel. Production and Preview
deployments must receive their required variables from Vercel; there is no
fallback to a local `.env` or database. Local `pnpm dev` continues to find the
repository-root `.env` through the pnpm workspace marker. If the marker is
absent from a packaged runtime, environment-file discovery returns no path
instead of preventing startup.

## Cookie and domain requirements

The application uses `HttpOnly`, `Secure`, `SameSite=Strict` session cookies
in production, sends credentials from the frontend, and validates request
origins. Keep these protections unchanged.

For separate frontend and backend projects, assign custom HTTPS domains under
the **same registrable domain**, such as `itsm.example.com` and
`itsm-api.example.com`. Configure the frontend origin exactly in
`CORS_ORIGINS`. These sibling hosts are cross-origin but same-site, so the
current Strict cookie policy can work with credentialed CORS. Vercel's
default project hostnames may be cross-site in browsers; do not assume the
session cookie will work between two unrelated `*.vercel.app` hosts. If you
cannot use same-site custom domains, use a same-origin reverse proxy design
or an explicitly reviewed authentication change rather than weakening cookie
or CSRF protections.

## Safe release sequence

1. Create both Vercel projects and set their root directories as above.
2. Assign same-site custom HTTPS domains and configure project environment
   variables in the correct projects and deployment environments.
3. Confirm the production `DATABASE_URL` is the intended Neon database and
   preserve its existing value. This deployment setup does not require a
   schema change.
4. Deploy the backend and verify `/api/v1/health`; then verify
   `/api/v1/health/ready` and authenticated application routes.
5. Set the frontend's `VITE_API_BASE_URL` to the backend API base and deploy
   the frontend. Verify login, credentialed requests, logout, and a React
   Router deep link on both desktop and mobile.
6. Run migrations separately only after reviewing the release migration plan
   and confirming the target database. Vercel deployments never run migrations
   automatically.

Vercel project configuration and production behavior still require a Vercel
deployment to verify. Local builds and tests cannot confirm the platform's
function bundling, production environment settings, database connectivity, or
browser cookie behavior on the final custom domains.

References: [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs),
[Vercel monorepos](https://vercel.com/docs/monorepos), and
[Vercel rewrites](https://vercel.com/docs/routing/rewrites).
