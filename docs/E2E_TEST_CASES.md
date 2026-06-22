# Salon Management — End-to-End Test Cases

**App:** Salon Management (vanilla JS frontend on GitHub Pages + Node/Express API on Render + Supabase Postgres)
**Live frontend:** https://niku-tndn15.github.io/salon-management/
**Live API base:** https://salon-management-9b29.onrender.com/api
**Health:** https://salon-management-9b29.onrender.com/health
**Owner login (testing):** `owner` / `Admin@123`

Conventions
- **Pre:** preconditions · **Steps** · **Expected** · **Type:** Manual (UI) / API / Auto (Jest)
- Roles: **OWNER**, **BILLING_PERSON**, **STAFF**
- Destructive API tests against live data must **revert** (change → verify → revert).
- Automated backend suite: `cd salon-backend && npm test` (64 tests, run without `DATABASE_URL` → DB endpoints assert `503 DB_NOT_CONFIGURED`; auth/RBAC/validation paths assert 401/403/400).

---

## 0. Environment / Smoke

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| SMK-01 | API health | `GET /health` | `200 {"status":"ok","db":"connected"}` | API |
| SMK-02 | Frontend loads | Open live frontend URL | Login page renders, no console errors | Manual |
| SMK-03 | Frontend points at live API | DevTools → Network on login | Requests go to `salon-management-9b29.onrender.com/api` | Manual |
| SMK-04 | Security headers | `GET /health` headers | `Strict-Transport-Security`, `X-Frame-Options: DENY`, no `X-Powered-By` | API/Auto |
| SMK-05 | Unknown route | `GET /does-not-exist` | `404 {code:"NOT_FOUND"}` | API/Auto |
| SMK-06 | Oversized body rejected | POST login with >1MB body | `413` | Auto |

---

## 1. Authentication & Session

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| AUTH-01 | Valid login | Login `owner`/`Admin@123` | `200`, JWT token + user `{role:OWNER}` returned | API/Manual |
| AUTH-02 | Wrong password | Login with bad password | `401 UNAUTHORIZED`, generic "Invalid username or password" (no user enumeration) | API |
| AUTH-03 | Unknown username | Login with random username | `401`, **same** generic message as AUTH-02 | API |
| AUTH-04 | Empty fields | Login `{username:"",password:""}` | `400 VALIDATION_ERROR` | Auto |
| AUTH-05 | Account lockout | 5 consecutive failed logins for one user, then correct password | After 5 fails account is locked for `LOGIN_WINDOW_MINUTES`; correct password still returns generic 401 until window passes | API |
| AUTH-06 | IP rate limit | >5 login attempts from one IP in window | `429 TOO_MANY_REQUESTS`; limit is **per client IP** (trust proxy = 1) not global | API |
| AUTH-07 | Protected route w/o token | `GET /api/auth/me` no header | `401 UNAUTHORIZED` | Auto |
| AUTH-08 | Malformed token | `GET /api/auth/me` `Authorization: Bearer garbage` | `401` "Invalid or expired token" | API |
| AUTH-09 | Expired token | Use token past `JWT_EXPIRES_IN` (8h) | `401` | API |
| AUTH-10 | Inactive user token | Token for a user whose status=INACTIVE | `401` "User is inactive or no longer exists" | API |
| AUTH-11 | Role refresh | Owner demotes user to STAFF; user reuses old OWNER token | Owner-only routes now `403` immediately (role read live from DB, not token) | API |
| AUTH-12 | Change password — weak | `POST /api/auth/change-password` newPassword `"weak"` | `400 VALIDATION_ERROR` (min 8, upper/lower/digit) | Auto |
| AUTH-13 | Change password — same as current | newPassword == currentPassword | `400` "must be different" | API |
| AUTH-14 | Change password — success | Valid current + strong new | `200`, subsequent login uses new password, `force_password_change=false` | API |
| AUTH-15 | Logout | `POST /api/auth/logout` | `200`; client discards token | Manual |
| AUTH-16 | Force password change | First login of a freshly created user | `forcePasswordChange:true`; UI prompts change | Manual |

---

## 2. RBAC (authorization matrix)

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| RBAC-01 | Non-owner lists users | STAFF/BILLING token → `GET /api/users` | `403 FORBIDDEN` | Auto |
| RBAC-02 | Non-owner creates service | non-OWNER → `POST /api/catalog/categories` | `403` | Auto |
| RBAC-03 | Non-owner deletes service | non-OWNER → `DELETE /api/catalog/services/:id` | `403` | Auto |
| RBAC-04 | Non-owner deletes invoice | non-OWNER → `DELETE /api/invoices/:id` | `403` | Auto |
| RBAC-05 | Non-owner deletes customer | BILLING → `DELETE /api/customers/:id` | `403` (create/edit allowed, delete owner-only) | API |
| RBAC-06 | Billing can create customer | BILLING → `POST /api/customers` | `201/200` allowed | API |
| RBAC-07 | Staff My Performance | STAFF → `GET /api/staff/:id/performance` (self) | allowed; OWNER sidebar hides "My Performance" | Manual |
| RBAC-08 | Owner full access | OWNER token → each module list endpoint | `200` | API |

---

## 3. Customers

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| CUST-01 | List customers | `GET /api/customers` | `200`, paginated `{customers, meta}` | API |
| CUST-02 | Create customer | Add with valid name/phone/gender/DOB/referral | created; appears in list | Manual/API |
| CUST-03 | Phone validation | Create with phone `"123"` | `400` "Phone must be 10 digits" | API |
| CUST-04 | DOB in future | Create with DOB tomorrow | `400` "Date of birth must be in the past" | API |
| CUST-05 | Duplicate active phone (create) | Create with existing active phone | blocked (UI) / `409` (API) | API |
| CUST-06 | Edit opens pre-filled | UI: click Edit | modal pre-filled incl. phone (editable) | Manual |
| CUST-07 | Edit name + save | Change name, Save | UI + DB updated | Manual/API |
| CUST-08 | **Edit phone + save** | Change phone to new 10-digit, Save | UI + DB updated (verify via GET) | API ✅verified |
| CUST-09 | Edit phone — invalid | Phone `"abc"`/<10 digits | `400`; UI shows "Enter a valid 10-digit phone number" | Manual/API |
| CUST-10 | Edit phone — duplicate | Change to another active customer's phone | `409` "Another customer already uses this phone number"; UI blocks | API ✅verified |
| CUST-11 | Delete customer (owner) | OWNER deletes | removed from UI + DB | Manual/API |
| CUST-12 | **Invoice history preserved** | Delete a customer who has invoices | customer gone; past invoices keep name/phone via snapshot (customer_id NULL) | API |
| CUST-13 | Search | Search by name/phone substring | filtered results | Manual |
| CUST-14 | Lapsed report | Open Lapsed tab | customers past threshold listed | Manual |
| CUST-15 | Birthdays report | Open Birthdays tab | upcoming birthdays listed | Manual |

---

## 4. Staff

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| STF-01 | List staff | `GET /api/staff?status=all` | `200` directory incl. join_date | API |
| STF-02 | Create staff + login | Add staff w/ name/phone/designation/commission/join_date | created; login credentials generated & shown once | Manual |
| STF-03 | Duplicate phone | Create with existing staff phone | `409 CONFLICT` | API |
| STF-04 | Edit name/designation | Edit + Save | UI + DB updated (PUT /staff/:id) | Manual/API |
| STF-05 | **Edit phone + save** | Change phone, Save | UI + DB updated (verify via GET) | API ✅verified |
| STF-06 | Edit phone — invalid | <10 digits | `400`; UI "Enter a valid 10-digit phone" | Manual |
| STF-07 | Commission change | Change commission % | new rate effective from tomorrow; history row added | API |
| STF-08 | Deactivate | Deactivate staff | status INACTIVE; linked login disabled | Manual |
| STF-09 | Delete staff (owner) | Delete | removed from UI+DB; login row + commission history removed | API |
| STF-10 | Invoice history preserved | Delete staff w/ past line items | staff gone; line items keep professional name snapshot | API |
| STF-11 | Performance report | Open report for staff + date range | revenue/commission/service counts render | Manual |
| STF-12 | Compare staff | Compare across range | comparison table sortable | Manual |

---

## 5. Service Catalog

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| CAT-01 | List services | `GET /api/catalog/services` | `200` grid | API |
| CAT-02 | Invalid status filter | `?status=archived` | `400 VALIDATION_ERROR` | Auto |
| CAT-03 | Add service | Add name/category/price/duration | created | Manual |
| CAT-04 | Duplicate name | Add existing (case-insensitive) name | blocked / conflict | API |
| CAT-05 | Edit service | Edit + Save | updated | Manual |
| CAT-06 | Deactivate/Activate | Toggle status | status flips | Manual |
| CAT-07 | Delete service (owner) | Delete | removed UI+DB | Manual/API |
| CAT-08 | **Card action layout** | View cards (esp. narrow widths) | Edit/Deactivate/Delete buttons stay inside card, wrap, no overflow | Manual ✅fixed |
| CAT-09 | Category filter | Click a category chip | grid filters | Manual |

---

## 6. Billing / Invoices

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| INV-01 | List invoices | `GET /api/invoices` | `200`, Past Invoices has Actions column | API |
| INV-02 | Create invoice | Add customer + line items, choose payment | invoice created w/ correct subtotal/discount/GST/total | Manual |
| INV-03 | Invoice number format | After create | `INV-YYYYMM-NNNN` sequential | API |
| INV-04 | Discount applied | Apply percentage/flat offer | discount + taxable + totals correct | Manual |
| INV-05 | GST calculation | GST enabled in settings | CGST/SGST split correct; GSTIN snapshot stored | Manual |
| INV-06 | Commission snapshot | Line item w/ staff | commission_pct snapshot recorded at sale time | API |
| INV-07 | Delete invoice (owner) | Delete | removed UI+DB | Manual/API |
| INV-08 | Refund | Process full/partial refund | refund recorded; invoice status REFUNDED | API |
| INV-09 | Invalid create payload | Missing/invalid fields | `400 VALIDATION_ERROR` | Auto |
| INV-10 | Invoice rate limit | >60 invoice requests/min | `429` (per user) | API |

---

## 7. Settings & Offers

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| SET-01 | Salon name default | Fresh DB | "Glamour Salon" | API |
| SET-02 | Get salon profile | `GET /api/settings/salon` | `200` profile | API |
| SET-03 | Partial salon save | `PUT /api/settings/salon {gst_enabled:false}` | `200`; partial update merges, no full-payload required | API ✅verified |
| SET-04 | Salon name → sidebar brand | Edit salon name, Save | sidebar brand updates live | Manual |
| SET-05 | Profile save | Edit profile fields, Save | persisted | Manual |
| SET-06 | GST & Billing save | Toggle GST/GSTIN, Save | persisted | Manual |
| SET-07 | Owner greeting | Dashboard as owner "Samay" | "Good morning/afternoon/evening, Samay!" | Manual |
| OFR-01 | List offers | `GET /api/settings/discounts` | `200` | API |
| OFR-02 | Create offer | Add %/flat offer | created | Manual |
| OFR-03 | % > 100 guard | Create percentage offer value 150 | `400`/rejected | API |
| OFR-04 | Deactivate offer | Toggle | status flips | Manual |
| OFR-05 | Delete offer (owner) | Delete | removed UI+DB; past invoices keep offer snapshot | Manual/API |

---

## 8. Dashboard

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| DASH-01 | KPIs | `GET /api/dashboard/kpis` | `200` revenue/customers/etc. | API |
| DASH-02 | Bad date param | `?start_date=bad-date` | `400 VALIDATION_ERROR` | Auto |
| DASH-03 | Revenue trend | open dashboard | chart renders | Manual |
| DASH-04 | Category split | open dashboard | chart renders | Manual |
| DASH-05 | Staff leaderboard | open dashboard | leaderboard renders | Manual |

---

## 9. Sync / Offline

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| SYNC-01 | Pull requires auth | `GET /api/sync/pull` no token | `401` | Auto |
| SYNC-02 | Push RBAC | wrong role push | `403` | Auto |
| SYNC-03 | Push validation | malformed push body | `400` | Auto |
| SYNC-04 | Offline banner | Go offline in UI | offline banner shows; actions queue locally (IndexedDB) | Manual |
| SYNC-05 | Duplicate phone conflict | Push customer w/ existing phone | conflict `DUPLICATE_PHONE` reported | API |
| SYNC-06 | Sync push rate limit | >10 pushes/min per device | `429` | API |

---

## 10. Data integrity & error handling

| ID | Title | Steps | Expected | Type |
|----|-------|-------|----------|------|
| ERR-01 | DB down behavior | API with DB unreachable | `503 DB_UNAVAILABLE` (not a 500 leak) | Auto |
| ERR-02 | No internal leak on 500 | Trigger server error | body message = "Internal server error", no stack | API |
| ERR-03 | SQL injection attempt | Search params like `' OR 1=1 --` | treated as literal value (parameterized); no injection | API |
| ERR-04 | CORS disallowed origin | Request from non-allowlisted Origin | blocked by CORS | API |
| ERR-05 | Migrations idempotent | Re-run `npm run db:migrate` | applied ones skipped; no errors | API |

---

## Automated coverage (Jest) — `salon-backend/tests/`

| Suite | Focus |
|-------|-------|
| `security.test.js` | trust proxy=1, HSTS/frameguard/no x-powered-by, 404 shape, 1MB body cap |
| `auth.test.js` | missing token, login validation, DB_NOT_CONFIGURED, weak password change |
| `customers.test.js` / `staff.test.js` / `catalog.test.js` / `invoices.test.js` / `settings.test.js` / `dashboard.test.js` / `sync.test.js` / `users.test.js` | auth (401), RBAC (403), validation (400), DB-not-configured (503) per module incl. delete routes |
| `health.test.js` | health endpoint |
| `unit/commission.test.js`, `unit/numbers.test.js`, `unit/invoiceNumber.test.js` | pure business logic (commission math, money rounding, invoice numbering) |

**Result:** 14 suites / 64 tests passing.

> Full data-mutating E2E (create→read→update→delete with DB assertions) is exercised manually against the live stack and via targeted API change→verify→revert scripts, since the Jest suite intentionally runs without a database to stay hermetic.
