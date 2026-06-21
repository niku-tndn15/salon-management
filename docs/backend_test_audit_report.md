# Backend Test Audit Report

Date: 2026-06-19  
Project: Salon Application Backend  
Scope: Backend milestones M0 through M11

## Executive Summary

Backend local verification is passing.

- JavaScript syntax check: PASSED
- Jest test suites: 13 passed, 13 total
- Jest test cases: 42 passed, 42 total
- Coverage run: PASSED
- Production dependency audit: PASSED, 0 vulnerabilities
- Supabase pooler smoke test from M11: PASSED

## Commands Run

```powershell
Get-ChildItem -Path salon-backend/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
npm.cmd test
npm.cmd run test:coverage -- --coverageReporters=text-summary
npm.cmd audit --omit=dev --audit-level=moderate
```

## Coverage Summary

```text
Statements : 37.98% (490/1290)
Branches   : 20.52% (94/458)
Functions  : 28.34% (53/187)
Lines      : 38.89% (487/1252)
```

Coverage is still the main improvement area. The current Jest suite verifies route auth, RBAC, validation, no-DB behavior, and core utilities. Supabase smoke testing verifies important DB-success paths, but those smoke checks do not count toward Jest coverage.

## Test Case Results

| Area | Test Case | Expected Result | Outcome |
|---|---|---|---|
| Health | `GET /health` returns API status when `DATABASE_URL` is not configured | HTTP 200 with `status: ok` | PASSED |
| Auth | Rejects missing auth token on `/api/auth/me` | HTTP 401 `UNAUTHORIZED` | PASSED |
| Auth | Validates invalid login payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Auth | Returns DB-not-configured response for login without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Auth | Validates weak password changes before DB access | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Catalog | Requires auth for catalog routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Catalog | Enforces OWNER role for category creation | HTTP 403 `FORBIDDEN` | PASSED |
| Catalog | Validates invalid service list query params | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Catalog | Returns DB-not-configured response for category list without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Customers | Requires auth for customer routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Customers | Blocks STAFF from customer list | HTTP 403 `FORBIDDEN` | PASSED |
| Customers | Validates invalid customer create payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Customers | Returns DB-not-configured response for customer list without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Invoices | Requires auth for invoice routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Invoices | Blocks STAFF from invoices | HTTP 403 `FORBIDDEN` | PASSED |
| Invoices | Validates invalid invoice create payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Invoices | Returns DB-not-configured response for invoice list without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Staff | Requires auth for staff routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Staff | Blocks BILLING_PERSON from staff list | HTTP 403 `FORBIDDEN` | PASSED |
| Staff | Validates invalid staff create payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Staff | Returns DB-not-configured response for staff list without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Dashboard | Requires auth for dashboard routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Dashboard | Blocks STAFF from dashboard KPIs | HTTP 403 `FORBIDDEN` | PASSED |
| Dashboard | Validates bad dashboard date ranges | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Dashboard | Returns DB-not-configured response for KPIs without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Settings | Requires auth for settings routes | HTTP 401 `UNAUTHORIZED` | PASSED |
| Settings | Blocks BILLING_PERSON from salon settings | HTTP 403 `FORBIDDEN` | PASSED |
| Settings | Validates salon GST payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Settings | Returns DB-not-configured response for discounts without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Users | Requires OWNER for users list | HTTP 403 `FORBIDDEN` | PASSED |
| Users | Validates invalid user creation payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Sync | Requires auth for sync pull | HTTP 401 `UNAUTHORIZED` | PASSED |
| Sync | Blocks STAFF from sync push | HTTP 403 `FORBIDDEN` | PASSED |
| Sync | Validates invalid sync push payloads | HTTP 400 `VALIDATION_ERROR` | PASSED |
| Sync | Returns DB-not-configured response for sync pull without DB | HTTP 503 `DB_NOT_CONFIGURED` | PASSED |
| Unit: Invoice Number | Generates `SAL-YYYYMM-NNNN` invoice numbers from DB sequence | Matching invoice number format | PASSED |
| Unit: Invoice Number | Generates `REF-YYYYMM-NNNN` refund numbers from DB sequence | Matching refund number format | PASSED |
| Unit: Commission | Returns active commission rate for requested service date | Numeric commission rate | PASSED |
| Unit: Commission | Falls back to 0 when no commission history exists | `0` | PASSED |
| Unit: Numbers | Normalizes nullish values and numeric strings | Correct numeric values | PASSED |
| Unit: Numbers | Rounds money to two decimal places | Correct money rounding | PASSED |
| Unit: Numbers | Coerces positive integers with fallback and max bounds | Correct bounded integer | PASSED |

## Supabase Smoke Test Outcome

The latest M11 Supabase smoke test used the working session pooler connection string and passed.

Verified endpoints:

- Login
- `/health`
- `/api/auth/me`
- `/api/catalog/categories`
- `/api/catalog/services`
- `/api/customers`
- `/api/invoices`
- `/api/staff`
- `/api/dashboard/kpis`
- `/api/dashboard/revenue-trend`
- `/api/settings/salon`
- `/api/settings/discounts`
- `/api/users`
- `/api/sync/pull`
- `/api/sync/push` duplicate customer conflict path

Important issue found and fixed during M11:

- `POST /api/sync/push` duplicate-customer conflict initially failed with PostgreSQL `42P08`.
- Root cause: nullable UUID parameter inference in the `sync_queue` insert.
- Fix: generate fallback UUID and processed timestamp in Node before insertion.
- Retest result: PASSED against Supabase.

## Dependency Health

Production dependency audit:

```text
npm audit --omit=dev --audit-level=moderate
found 0 vulnerabilities
```

The unused `uuid` package was removed from backend dependencies because the code now uses Node's built-in `crypto.randomUUID()`.

## Current Health Check

Status: GOOD

The backend is locally healthy through M11. Core route protections, validation paths, no-DB resilience, utility behavior, and Supabase pooler smoke checks are passing.

Recommended next improvements:

- Add Jest-backed DB integration tests for successful database paths.
- Raise coverage before production hardening sign-off.
- Keep using Supabase session pooler instead of the direct IPv6-only database host.
