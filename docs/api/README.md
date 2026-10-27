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

## Master data

Master data is managed through the authenticated `/master-data` workspace.
It reuses the existing asset category, location, and ticket category APIs and
adds department and vendor management on the existing catalog controller.
Mutations require the corresponding `assets.update` or `tickets.update`
permission and an allowed request origin; reads use the matching asset or
ticket read permissions. The people section links to the existing user
administration page and does not duplicate user management.

The additional department and vendor endpoints are:

| Method  | Route              | Permission      | Purpose                                        |
| ------- | ------------------ | --------------- | ---------------------------------------------- |
| `GET`   | `/departments`     | `assets.read`   | List departments with active member counts     |
| `POST`  | `/departments`     | `assets.update` | Create a department                            |
| `PATCH` | `/departments/:id` | `assets.update` | Update a name, description, or status          |
| `GET`   | `/vendors`         | `assets.read`   | List vendors with asset/maintenance references |
| `POST`  | `/vendors`         | `assets.update` | Create a vendor                                |
| `PATCH` | `/vendors/:id`     | `assets.update` | Update vendor contact details                  |

Departments can be deactivated rather than deleted so existing user
relationships remain intact. Vendors have no active-state column and are not
deleted; their asset and maintenance references are shown. Asset and ticket
categories and locations also retain their existing active/inactive lifecycle.
Status and condition values remain workflow-controlled and are not editable
master data. No database migration is needed for the department and vendor
endpoints because their tables and relationships already exist.

## Asset CSV import and export

Asset CSV tools use the existing `assets`, `asset_categories`, `locations`,
`asset_status_history`, and `audit_logs` tables; no migration or import-history
table is required.

### Endpoints and permissions

All routes use the `/api/v1` prefix and require a valid session:

| Method | Route                     | Permission        | Purpose                                      |
| ------ | ------------------------- | ----------------- | -------------------------------------------- |
| `GET`  | `/assets/import/template` | `assets.create`   | Download the UTF-8 CSV template              |
| `POST` | `/assets/import/preview`  | `assets.create`   | Validate an uploaded CSV without writing     |
| `POST` | `/assets/import`          | `assets.create`   | Revalidate and atomically create assets      |
| `GET`  | `/assets/export.csv`      | `assets.read.all` | Export permitted assets, optionally filtered |

Import requests must include the allowed `Origin` and a multipart form field
named `file`. Uploads are limited to 5 MB and 500 data rows. The server checks
the `.csv` extension, strict UTF-8 decoding, CSV structure, headers, field
limits, references, and unique asset identifiers; the browser's file picker
filter is not a security control.

### Template columns

The template uses these stable, case-sensitive headers:

| Column          | Required | Description                                               |
| --------------- | -------- | --------------------------------------------------------- |
| `assetTag`      | Yes      | Unique asset tag (up to 100 characters)                   |
| `name`          | Yes      | Asset name (up to 200 characters)                         |
| `categoryCode`  | Yes      | Code of an active asset category                          |
| `manufacturer`  | No       | Up to 150 characters                                      |
| `model`         | No       | Up to 150 characters                                      |
| `serialNumber`  | No       | Unique among active assets; up to 150 characters          |
| `description`   | No       | Up to 2,000 characters                                    |
| `locationCode`  | No       | Code of an active location                                |
| `purchaseDate`  | No       | Valid `YYYY-MM-DD` date                                   |
| `purchaseCost`  | No       | Non-negative decimal with at most 2 decimal places        |
| `warrantyStart` | No       | Valid `YYYY-MM-DD` date                                   |
| `warrantyEnd`   | No       | Valid `YYYY-MM-DD` date, not earlier than `warrantyStart` |
| `notes`         | No       | Up to 2,000 characters                                    |

Save Excel workbooks as **CSV UTF-8 (Comma delimited)** before uploading.
Quoted fields, commas and escaped quotes are supported. Empty optional values
are stored as null. Categories and locations are matched by code, not display
name. For compatibility, imports also accept `asset_tag`, `asset_name`,
`category`, `brand`, `serial_number`, `location`, `purchase_date`, and
`warranty_expiry` as aliases for their matching template columns. The `category`
and `location` values must still be active category and location codes. The
`status` and `condition` headers are accepted for older spreadsheets, but their
values are ignored and shown as preview warnings; imported assets are always
created as `AVAILABLE` with `GOOD` condition. The CSV cannot set assignment,
shared access, or immutable asset identifiers. Export output uses the template
columns and can be filtered with the existing `search`, `status`, `categoryId`,
and `locationId` query parameters. It contains only non-deleted records visible
to the authorized user.

### Validation, transaction, and audit behavior

Preview results include total, valid, invalid, and warning counts plus row-level
field errors. Duplicate asset tags are checked against all stored rows because
the asset-tag database constraint includes soft-deleted assets. Serial
numbers are checked against active assets. Duplicate values inside the file
and unknown or inactive category/location codes block import. Only **Create
Only** is supported; existing assets are never updated.

The import action uploads the same CSV again. The server reparses and
revalidates it inside the database transaction rather than trusting preview
data from the browser. All rows, asset status-history entries, and audit rows
commit together or roll back together. Unique-constraint conflicts caused by
concurrent imports reject the entire batch. An `assets.csv_imported` audit
event records the operation identifier, safely normalized filename, mode, and
counts. There is no separate import-history table or history endpoint. When
preview contains blocking errors, the frontend can download a CSV error report
containing row number, asset tag, field, error code, and explanation.

CSV exports quote fields and prefix formula-like values with an apostrophe to
reduce spreadsheet formula-injection risk without changing stored data.

Focused parser and validation tests run with:

```powershell
pnpm.cmd --filter api exec vitest run test/asset-csv.test.ts
```

## Reports date filters

`startDate` and `endDate` accept date-only `YYYY-MM-DD` values. The API
validates that each value is a real calendar date; timestamps, timezone
offsets, malformed dates, and impossible dates are rejected. The end date is
inclusive and report SQL uses the following UTC midnight as its exclusive
upper bound. If omitted, `endDate` defaults to the current UTC date and
`startDate` defaults to 29 calendar days earlier, for a 30-day inclusive
period. The maximum inclusive range is 367 calendar days.

The reports UI sends date-only values from date inputs. It does not send
timestamps or timezone offsets.
