# Architecture decisions

## pnpm workspace

Use pnpm workspaces to keep independently runnable frontend and API applications
under one lockfile and root quality scripts.

## Separate frontend and backend

React/Vite owns browser presentation and a small API client. NestJS owns REST
transport, configuration, and backend responsibilities. Business logic is not
placed in the frontend or a shared package.

## REST version prefix

Nest applies `/api/v1` globally so future API changes can be versioned without
coupling routes to frontend implementation details.

## TypeORM with explicit migrations

TypeORM 0.3 is selected for NestJS/PostgreSQL integration and explicit
migration tooling. Read-only inspection found 26 existing application tables
in `it_db` and no migration history. No feature entities are added yet;
synchronize and migrations-on-start are disabled. Map and baseline the existing
schema only after review before introducing migrations.

## No placeholder shared packages

Shared contracts/configuration packages are deferred until there is an actual
cross-application contract or reusable tooling configuration beyond root-level
lint/format settings.
