# Backend Implementation Plan — Salon Management Web App
**Version:** 1.0 | **Date:** 2026-06-17 | **Stack:** Node.js · Express · PostgreSQL · JWT · Zod

---

## Overview

The backend replaces the frontend's Dexie.js (IndexedDB) data layer with a real server-side API. The frontend business logic, UI, and validations remain identical — only the data persistence and auth verification layer changes.

**Pre-condition:** Frontend is 100% complete and all M10 tests have passed before this plan begins.

**What this backend provides:**
- Persistent, multi-device data storage (PostgreSQL)
- Real authentication (bcrypt + JWT)
- Server-enforced RBAC (HTTP 403 on unauthorized calls)
- Multi-device sync and conflict resolution
- Production-grade invoice numbering (no LOCAL numbers in production)
- Foundation for future features: WhatsApp API, analytics exports, multi-branch

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | Matches JS skill from frontend; massive ecosystem |
| Framework | Express.js 4.x | Minimal, well-understood, easy to test |
| Database | PostgreSQL 16 | Reliable, ACID-compliant, excellent for analytics queries |
| ORM / Query Builder | `pg` (node-postgres) with raw SQL | Full control over queries; no hidden magic |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) | Industry standard; stateless; easy to verify |
| Validation | Zod | TypeScript-grade runtime validation; excellent error messages |
| Rate Limiting | `express-rate-limit` | Protects login and sensitive endpoints |
| Environment | `dotenv` | Secrets management |
| Logging | `morgan` (HTTP) + `winston` (app logs) | Structured logs for debugging and monitoring |
| Testing | Jest + Supertest | Unit tests (services) + integration tests (API routes) |
| Migration | Custom SQL migration scripts | Simple, no ORM lock-in |
| Deployment | Railway / Render (PaaS) + Supabase (PostgreSQL) | Zero-ops for MVP; Supabase provides managed PostgreSQL |

---

## Complete File Structure

```
salon-backend/
│
├── src/
│   ├── app.js                        # Express app setup (no listen)
│   ├── server.js                     # HTTP server entry point (listen)
│   │
│   ├── config/
│   │   ├── db.js                     # PostgreSQL pool (pg.Pool)
│   │   └── env.js                    # Validated environment variables (Zod)
│   │
│   ├── middleware/
│   │   ├── auth.js                   # JWT verification; attaches req.user
│   │   ├── rbac.js                   # Role check factory: requireRole('OWNER')
│   │   ├── validate.js               # Zod schema validation middleware factory
│   │   ├── rateLimiter.js            # Login rate limiter (5 attempts / 15 min)
│   │   └── errorHandler.js           # Global error handler; formats all 4xx/5xx
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── salon.routes.js           # Salon profile
│   │   ├── catalog.routes.js         # Services + categories
│   │   ├── customers.routes.js
│   │   ├── invoices.routes.js        # Invoices + refunds
│   │   ├── staff.routes.js           # Staff + commission
│   │   ├── dashboard.routes.js       # Aggregation endpoints
│   │   ├── settings.routes.js        # GST config + discount offers
│   │   └── users.routes.js           # User management (OWNER only)
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── salon.controller.js
│   │   ├── catalog.controller.js
│   │   ├── customers.controller.js
│   │   ├── invoices.controller.js
│   │   ├── staff.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── settings.controller.js
│   │   └── users.controller.js
│   │
│   ├── services/                     # Pure business logic (no HTTP, no DB direct)
│   │   ├── auth.service.js
│   │   ├── catalog.service.js
│   │   ├── customers.service.js
│   │   ├── invoices.service.js       # Invoice numbering, calculation engine
│   │   ├── staff.service.js          # Commission calculation engine
│   │   ├── dashboard.service.js      # KPI aggregation logic
│   │   └── sync.service.js           # Offline sync queue processing
│   │
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_seed_data.sql
│   │   │   └── run_migrations.js
│   │   └── queries/                  # Named SQL query files per entity
│   │       ├── customers.sql.js
│   │       ├── invoices.sql.js
│   │       ├── staff.sql.js
│   │       └── dashboard.sql.js
│   │
│   └── utils/
│       ├── invoiceNumber.js          # Sequential invoice number generator
│       ├── commission.js             # Commission rate resolver by date
│       └── pagination.js             # Pagination helper
│
├── tests/
│   ├── unit/
│   │   ├── invoiceNumber.test.js
│   │   ├── commission.test.js
│   │   └── dashboard.test.js
│   └── integration/
│       ├── auth.test.js
│       ├── customers.test.js
│       ├── invoices.test.js
│       └── staff.test.js
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Milestone M0 — Project Setup

### 0.1 — `package.json` Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "morgan": "^1.10.0",
    "winston": "^3.11.0",
    "express-rate-limit": "^7.1.5",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "nodemon": "^3.0.2"
  }
}
```

### 0.2 — `.env.example`

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/salon_db

# Auth
JWT_SECRET=your-very-long-random-secret-min-64-chars
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=12

# Server
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5500,https://your-salon-app.com

# Rate Limiting
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
```

### 0.3 — `src/config/db.js`

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),  // for transactions
};
```

### 0.4 — Standard API Response Format

All endpoints return JSON in this shape:
```json
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "total": 42 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

Error codes (string enums):
- `VALIDATION_ERROR` — Zod validation failed (400)
- `UNAUTHORIZED` — missing or invalid JWT (401)
- `FORBIDDEN` — valid JWT but insufficient role (403)
- `NOT_FOUND` — resource doesn't exist (404)
- `CONFLICT` — duplicate unique field (409)
- `INTERNAL_ERROR` — unexpected server error (500)

### 0.5 — M0 Testing Checkpoint

- [ ] `npm run dev` starts server on PORT 3000 without errors
- [ ] `GET /health` returns `{ "status": "ok", "db": "connected" }`
- [ ] PostgreSQL connection verified (pool connects to database)

---

## Milestone M1 — Database Schema

**File:** `src/db/migrations/001_initial_schema.sql`

### 1.1 — Complete PostgreSQL Schema

```sql
-- ─── EXTENSIONS ───────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── SALON PROFILE ────────────────────────────────────
CREATE TABLE salon_profile (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  phone        VARCHAR(15) NOT NULL,
  gst_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  gstin        VARCHAR(15),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gstin_when_enabled CHECK (
    gst_enabled = FALSE OR (gst_enabled = TRUE AND gstin IS NOT NULL AND LENGTH(gstin) = 15)
  )
);

-- ─── USERS ────────────────────────────────────────────
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username              VARCHAR(50) UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  role                  VARCHAR(20) NOT NULL CHECK (role IN ('OWNER','BILLING_PERSON','STAFF')),
  status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  force_password_change BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts       INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SERVICE CATEGORIES ───────────────────────────────
CREATE TABLE service_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SERVICES ─────────────────────────────────────────
CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL,
  category_id       UUID NOT NULL REFERENCES service_categories(id),
  price             NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes >= 1),
  description       TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_service_name_lower ON services (LOWER(name));

-- ─── STAFF ────────────────────────────────────────────
CREATE TABLE staff (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID UNIQUE REFERENCES users(id),  -- linked login account
  name                 VARCHAR(100) NOT NULL,
  phone                VARCHAR(10) UNIQUE NOT NULL,
  designation          VARCHAR(100) NOT NULL,
  commission_pct       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
  join_date            DATE NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  deactivation_date    DATE,
  deactivation_reason  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE commission_rate_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID NOT NULL REFERENCES staff(id),
  commission_pct  NUMERIC(5,2) NOT NULL CHECK (commission_pct BETWEEN 0 AND 100),
  effective_from  DATE NOT NULL,
  effective_to    DATE,               -- NULL = currently active
  changed_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CUSTOMERS ────────────────────────────────────────
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  phone            VARCHAR(10) NOT NULL,
  gender           VARCHAR(20) NOT NULL CHECK (gender IN ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')),
  date_of_birth    DATE NOT NULL CHECK (date_of_birth < CURRENT_DATE),
  referral_source  VARCHAR(30) NOT NULL CHECK (referral_source IN ('WALK_IN','FRIEND_REFERRAL','INSTAGRAM','GOOGLE','FACEBOOK','OTHER')),
  notes            TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','MERGED','DELETED')),
  merged_into_id   UUID REFERENCES customers(id),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ,
  updated_by       UUID REFERENCES users(id),
  CONSTRAINT uq_customer_phone_active UNIQUE (phone) -- enforced by application for ACTIVE+PENDING only
);
CREATE UNIQUE INDEX uq_active_customer_phone ON customers(phone) WHERE status = 'ACTIVE';

-- ─── PREDEFINED DISCOUNT OFFERS ───────────────────────
CREATE TABLE predefined_discount_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE','FLAT')),
  discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pct_max CHECK (discount_type != 'PERCENTAGE' OR discount_value <= 100)
);
CREATE UNIQUE INDEX uq_active_offer_name ON predefined_discount_offers(LOWER(name)) WHERE status = 'ACTIVE';

-- ─── INVOICES ─────────────────────────────────────────
CREATE SEQUENCE invoice_seq START 1;

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number      VARCHAR(30) UNIQUE NOT NULL,  -- SAL-YYYYMM-NNNN
  customer_id         UUID NOT NULL REFERENCES customers(id),
  created_by          UUID NOT NULL REFERENCES users(id),
  invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method      VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','UPI','CARD')),
  subtotal            NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  discount_type       VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (discount_type IN ('NONE','PERCENTAGE','FLAT')),
  discount_value      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_offer_id   UUID REFERENCES predefined_discount_offers(id),
  taxable_amount      NUMERIC(10,2) NOT NULL CHECK (taxable_amount >= 0),
  gst_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  cgst_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  grand_total         NUMERIC(10,2) NOT NULL CHECK (grand_total >= 0),
  status              VARCHAR(30) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID','REFUNDED','PARTIALLY_REFUNDED')),
  gstin_snap          VARCHAR(15),
  salon_name_snap     TEXT NOT NULL,
  salon_address_snap  TEXT NOT NULL,
  salon_phone_snap    VARCHAR(15) NOT NULL
);

CREATE INDEX idx_invoices_customer   ON invoices(customer_id);
CREATE INDEX idx_invoices_date       ON invoices(invoice_date);
CREATE INDEX idx_invoices_status     ON invoices(status);
CREATE INDEX idx_invoices_payment    ON invoices(payment_method);

CREATE TABLE invoice_line_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id            UUID REFERENCES services(id),  -- nullable if service permanently deleted
  service_name_snap     VARCHAR(100) NOT NULL,
  unit_price_snap       NUMERIC(10,2) NOT NULL CHECK (unit_price_snap >= 0),
  is_price_override     BOOLEAN NOT NULL DEFAULT FALSE,
  professional_id       UUID NOT NULL REFERENCES staff(id),
  professional_name_snap VARCHAR(100) NOT NULL
);

CREATE INDEX idx_line_items_invoice      ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_professional ON invoice_line_items(professional_id);
CREATE INDEX idx_line_items_service      ON invoice_line_items(service_id);

-- ─── REFUNDS ──────────────────────────────────────────
CREATE SEQUENCE refund_seq START 1;

CREATE TABLE refunds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_number   VARCHAR(30) UNIQUE NOT NULL,   -- REF-YYYYMM-NNNN
  invoice_id      UUID UNIQUE NOT NULL REFERENCES invoices(id),  -- UNIQUE: one refund per invoice
  refund_type     VARCHAR(10) NOT NULL CHECK (refund_type IN ('FULL','PARTIAL')),
  refund_amount   NUMERIC(10,2) NOT NULL CHECK (refund_amount > 0),
  reason          TEXT NOT NULL,
  processed_by    UUID NOT NULL REFERENCES users(id),
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SYNC QUEUE ───────────────────────────────────────
CREATE TABLE sync_queue (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id    VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50) NOT NULL,   -- 'invoice', 'customer', 'refund', etc.
  entity_id    UUID NOT NULL,
  operation    VARCHAR(20) NOT NULL,   -- 'CREATE', 'UPDATE'
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','PROCESSED','CONFLICT')),
  processed_at TIMESTAMPTZ,
  conflict_reason TEXT
);
```

### 1.2 — Seed Data Migration

**File:** `src/db/migrations/002_seed_data.sql`

Seed: 5 service categories, 12 services, 1 owner user, 2 billing users, 4 staff profiles, 3 discount offers, 8 customers, 120 invoices (30-day history).

Script structure:
```sql
-- Insert categories
INSERT INTO service_categories (id, name) VALUES
  (uuid_generate_v4(), 'Hair'),
  (uuid_generate_v4(), 'Skin'),
  ...;

-- Insert owner user (bcrypt hash of 'Admin@123')
INSERT INTO users (id, username, password_hash, full_name, role, force_password_change) VALUES
  (uuid_generate_v4(), 'owner', '$2b$12$...', 'Salon Owner', 'OWNER', FALSE);

-- [full seed data follows same pattern]
```

### 1.3 — Migration Runner

**File:** `src/db/migrations/run_migrations.js`

```javascript
// Reads all .sql files in /migrations in order, executes sequentially
// Tracks completed migrations in a `schema_migrations` table
// Idempotent: skips already-applied migrations
```

Run with: `node src/db/migrations/run_migrations.js`

### 1.4 — M1 Testing Checkpoint

- [ ] `psql salon_db -c "\dt"` shows all 14 tables
- [ ] All foreign key constraints verified (`\d invoices` shows FKs)
- [ ] Seed data present: `SELECT COUNT(*) FROM invoices` returns ~120
- [ ] Unique constraint test: insert duplicate active customer phone → PostgreSQL error
- [ ] Sequence test: `SELECT nextval('invoice_seq')` increments correctly

---

## Milestone M2 — Authentication API

### 2.1 — Middleware: `src/middleware/auth.js`

```javascript
module.exports = function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' }});
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;  // { id, username, role, name }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }});
  }
};
```

### 2.2 — Middleware: `src/middleware/rbac.js`

```javascript
module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ... });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }});
    }
    next();
  };
};
```

### 2.3 — Login Rate Limiter: `src/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,                       // 5 attempts per window per IP
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.' }},
  standardHeaders: true,
  legacyHeaders: false,
});
```

Note: Rate limiting is also enforced per-username in the database (`failed_attempts` + `locked_until` columns), covering cases where an attacker tries the same username from different IPs.

### 2.4 — Auth Routes

**File:** `src/routes/auth.routes.js`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login; returns JWT |
| POST | `/api/auth/logout` | Required | Invalidates session (client clears token) |
| POST | `/api/auth/change-password` | Required | Change own password |
| GET | `/api/auth/me` | Required | Returns current user info |

**POST `/api/auth/login`**

Request:
```json
{ "username": "owner", "password": "Admin@123" }
```

Logic:
```
1. Zod validate: username and password non-empty strings
2. Find user WHERE username = ? AND status = 'ACTIVE'
   → Not found: return 401 UNAUTHORIZED (generic message — no username enumeration)
3. Check locked_until: if locked_until > NOW(): return 401 with "Account locked until HH:MM"
4. bcrypt.compare(password, user.password_hash)
   → Mismatch:
     - INCREMENT failed_attempts
     - IF failed_attempts >= 5: SET locked_until = NOW() + 15 minutes, failed_attempts = 0
     - Return 401 UNAUTHORIZED
   → Match:
     - RESET failed_attempts = 0, locked_until = NULL
     - UPDATE last_login_at = NOW()
     - Sign JWT: { id, username, role, name }, expiresIn: JWT_EXPIRES_IN
5. Return:
   { "success": true, "data": { "token": "...", "user": { id, username, role, name }, "forcePasswordChange": true/false } }
```

**POST `/api/auth/change-password`**

Request:
```json
{ "currentPassword": "...", "newPassword": "..." }
```

Validation:
- `newPassword` min 8 chars, 1 uppercase, 1 lowercase, 1 digit
- `newPassword` ≠ `currentPassword` (cannot reuse immediately preceding)

On success:
- Hash new password with bcrypt (12 rounds)
- Update `password_hash`, set `force_password_change = false`, `updated_at = NOW()`
- Return `{ "success": true, "data": { "message": "Password changed successfully" } }`

### 2.5 — M2 Testing Checkpoint

- [ ] `POST /api/auth/login` with valid credentials → 200 with JWT
- [ ] Decode JWT → contains `{ id, username, role, name }`
- [ ] `POST /api/auth/login` wrong password 5 times → 6th attempt returns 401 with lockout message
- [ ] Locked account auto-unlocks after 15 minutes (verify `locked_until` cleared in DB)
- [ ] `GET /api/auth/me` with valid token → 200 with user info
- [ ] `GET /api/auth/me` without token → 401 UNAUTHORIZED
- [ ] `POST /api/auth/change-password` with weak new password → 400 VALIDATION_ERROR

---

## Milestone M3 — Service Catalog API

**File:** `src/routes/catalog.routes.js`

### 3.1 — Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/catalog/categories` | Required | All | List all categories |
| POST | `/api/catalog/categories` | Required | OWNER | Create category |
| GET | `/api/catalog/services` | Required | All | List services (active only for BILLING_PERSON) |
| POST | `/api/catalog/services` | Required | OWNER | Create service |
| PUT | `/api/catalog/services/:id` | Required | OWNER | Update service |
| PATCH | `/api/catalog/services/:id/status` | Required | OWNER | Activate/deactivate |
| DELETE | `/api/catalog/services/:id` | Required | OWNER | Hard delete (only if no invoice history) |

**GET `/api/catalog/services`**

Query params: `?status=active|inactive|all&category_id=<uuid>&search=<text>&page=1&limit=50`

Role logic:
- BILLING_PERSON: always returns only `status = 'active'` regardless of query param
- OWNER: returns based on `?status` param (default: all)

**POST `/api/catalog/services`**

Request validation (Zod):
```javascript
z.object({
  name: z.string().min(1).max(100),
  category_id: z.string().uuid(),
  price: z.number().min(0),
  duration_minutes: z.number().int().min(1),
  description: z.string().max(500).optional(),
  status: z.enum(['active','inactive']).default('active')
})
```

Uniqueness check: `SELECT id FROM services WHERE LOWER(name) = LOWER($1)` — return 409 CONFLICT if found.

**DELETE `/api/catalog/services/:id`**

Check: `SELECT COUNT(*) FROM invoice_line_items WHERE service_id = $1` — if count > 0, return 400 with message "Deactivate this service instead — it has invoice history."

---

## Milestone M4 — Customer Management API

**File:** `src/routes/customers.routes.js`

### 4.1 — Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/customers` | Required | OWNER, BILLING | Search/list customers |
| POST | `/api/customers` | Required | OWNER, BILLING | Create customer |
| GET | `/api/customers/:id` | Required | OWNER, BILLING | Get customer + computed stats |
| PUT | `/api/customers/:id` | Required | OWNER, BILLING | Update customer (not phone) |
| GET | `/api/customers/:id/visits` | Required | OWNER, BILLING | Customer visit history |
| GET | `/api/customers/reports/lapsed` | Required | OWNER | Lapsed customers list |
| GET | `/api/customers/reports/birthdays` | Required | OWNER, BILLING | Upcoming birthdays (7 days) |
| GET | `/api/customers/reports/referrals` | Required | OWNER | Referral source breakdown |
| POST | `/api/customers/merge` | Required | OWNER | Merge two profiles |

**GET `/api/customers`**

Query params: `?phone=<digits>&name=<text>&page=1&limit=20`

SQL:
```sql
SELECT c.*, 
  COUNT(DISTINCT i.id) AS total_visits,
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.status = 'PAID'), 0) AS lifetime_spend,
  MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID') AS last_visit_date
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.status = 'ACTIVE'
  AND ($1::text IS NULL OR c.phone LIKE $1 || '%')
  AND ($2::text IS NULL OR LOWER(c.name) LIKE '%' || LOWER($2) || '%')
GROUP BY c.id
ORDER BY c.name
LIMIT $3 OFFSET $4;
```

**GET `/api/customers/:id`** — includes all computed fields:
```sql
SELECT c.*,
  COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'PAID'), 0) AS total_visits,
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.status = 'PAID'), 0) AS lifetime_spend,
  MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID') AS last_visit_date,
  NOW()::date - MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID') AS days_since_last_visit
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.id = $1
GROUP BY c.id;
```

Computed in service layer:
- `age`: calculated from `date_of_birth`
- `average_spend`: `lifetime_spend / total_visits` (0 if no visits)
- `is_lapsed`: `days_since_last_visit >= 45 AND total_visits > 0`
- `birthday_upcoming`: day/month of DOB within today+7

**GET `/api/customers/reports/lapsed`**

Query params: `?threshold_days=45&page=1&limit=50`

```sql
SELECT c.id, c.name, c.phone,
  MAX(i.invoice_date) AS last_visit_date,
  NOW()::date - MAX(i.invoice_date) AS days_inactive,
  COUNT(i.id) AS total_visits,
  SUM(i.grand_total) AS lifetime_spend
FROM customers c
JOIN invoices i ON i.customer_id = c.id AND i.status = 'PAID'
WHERE c.status = 'ACTIVE'
GROUP BY c.id
HAVING NOW()::date - MAX(i.invoice_date) >= $1
ORDER BY days_inactive DESC;
```

**POST `/api/customers/merge`**

Request: `{ "primary_id": "<uuid>", "secondary_id": "<uuid>" }`

Transaction:
```sql
BEGIN;
  -- Re-link all invoices from secondary to primary
  UPDATE invoices SET customer_id = $primary WHERE customer_id = $secondary;
  -- Mark secondary as MERGED
  UPDATE customers SET status = 'MERGED', merged_into_id = $primary WHERE id = $secondary;
COMMIT;
```

---

## Milestone M5 — Invoicing API

**File:** `src/routes/invoices.routes.js`

### 5.1 — Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/invoices` | Required | OWNER, BILLING | Create invoice (with line items) |
| GET | `/api/invoices` | Required | OWNER, BILLING | List/search invoices |
| GET | `/api/invoices/:id` | Required | OWNER, BILLING | Invoice detail with line items |
| POST | `/api/invoices/:id/refund` | Required | OWNER, BILLING | Process full or partial refund |

### 5.2 — Invoice Number Generator

**File:** `src/utils/invoiceNumber.js`

```javascript
async function generateInvoiceNumber(db) {
  // Uses PostgreSQL sequence + formatting — atomic and collision-free
  const { rows } = await db.query("SELECT nextval('invoice_seq') AS seq");
  const seq = rows[0].seq;
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `SAL-${yyyymm}-${String(seq).padStart(4, '0')}`;
  // e.g., SAL-202607-0042
}
```

Key: `invoice_seq` is a PostgreSQL SEQUENCE — guarantees no duplicate or race-condition numbers even under concurrent requests.

### 5.3 — POST `/api/invoices` — Create Invoice

**Request body:**
```json
{
  "customer_id": "uuid",
  "payment_method": "UPI",
  "discount_type": "PERCENTAGE",
  "discount_value": 10,
  "discount_offer_id": "uuid or null",
  "line_items": [
    { "service_id": "uuid", "service_name_snap": "Haircut", "unit_price_snap": 400, "is_price_override": false, "professional_id": "uuid", "professional_name_snap": "Ravi" },
    { "service_id": "uuid", "service_name_snap": "Facial", "unit_price_snap": 600, "is_price_override": false, "professional_id": "uuid", "professional_name_snap": "Sunita" }
  ]
}
```

**Server-side calculation (do NOT trust client-sent totals):**
```javascript
// Always recalculate on server
const subtotal = lineItems.reduce((sum, item) => sum + item.unit_price_snap, 0);
const discountAmount = calculateDiscount(subtotal, discount_type, discount_value);
const taxableAmount = subtotal - discountAmount;
const gstEnabled = (await getSalonProfile()).gst_enabled;
const cgst = gstEnabled ? Math.round(taxableAmount * 0.09 * 100) / 100 : 0;
const sgst = gstEnabled ? Math.round(taxableAmount * 0.09 * 100) / 100 : 0;
const grandTotal = taxableAmount + cgst + sgst;
```

**Transaction:**
```javascript
const client = await db.getClient();
try {
  await client.query('BEGIN');
  const invoiceNumber = await generateInvoiceNumber(client);
  const salon = await getSalonProfile(client);
  const invoice = await client.query(INSERT_INVOICE, [invoiceNumber, customer_id, ...calculations, salon_snaps]);
  for (const item of lineItems) {
    await client.query(INSERT_LINE_ITEM, [invoice.id, ...item]);
  }
  await client.query('COMMIT');
  return invoice;
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
}
```

**Validations (server-side, regardless of client):**
- customer exists and status = 'ACTIVE'
- line_items.length >= 1
- All professional_ids reference active staff
- All service_ids reference existing services (if provided)
- discount_value: percentage 0–100, flat ≤ subtotal
- payment_method in ('CASH','UPI','CARD')

### 5.4 — GET `/api/invoices`

Query params: `?search=<text>&start_date=<ISO>&end_date=<ISO>&payment_method=CASH|UPI|CARD&status=PAID|REFUNDED|PARTIALLY_REFUNDED&page=1&limit=20`

SQL joins invoices with customers and refunds for status display.

### 5.5 — POST `/api/invoices/:id/refund`

Request:
```json
{ "refund_type": "PARTIAL", "refund_amount": 200, "reason": "Customer unhappy with colour" }
```

Validations:
- Invoice status must be 'PAID' → 400 if already refunded
- `refund_amount` > 0
- If FULL: refund_amount must equal grand_total
- If PARTIAL: refund_amount must be < grand_total and ≥ 1

Transaction:
```javascript
BEGIN;
  INSERT INTO refunds (refund_number, invoice_id, refund_type, refund_amount, reason, processed_by)
  VALUES (nextRefundNumber, invoice_id, type, amount, reason, req.user.id);
  UPDATE invoices SET status = $newStatus WHERE id = $invoice_id;
COMMIT;
```

`refund_seq` PostgreSQL sequence generates refund numbers — same pattern as invoice_seq.

---

## Milestone M6 — Staff Performance API

**File:** `src/routes/staff.routes.js`

### 6.1 — Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/staff` | Required | OWNER | List all staff |
| POST | `/api/staff` | Required | OWNER | Create staff profile + user account |
| GET | `/api/staff/:id` | Required | OWNER, STAFF* | Get staff profile |
| PUT | `/api/staff/:id` | Required | OWNER | Update staff profile |
| PATCH | `/api/staff/:id/status` | Required | OWNER | Activate/deactivate |
| GET | `/api/staff/:id/commission-history` | Required | OWNER | Commission rate history |
| PUT | `/api/staff/:id/commission` | Required | OWNER | Update commission % |
| GET | `/api/staff/:id/performance` | Required | OWNER, STAFF* | Performance report for date range |
| GET | `/api/staff/compare` | Required | OWNER | Comparative report (all staff) |

*STAFF role: can only access their own `staff_id` (enforced at service layer)

### 6.2 — POST `/api/staff` — Create Staff

Transaction:
1. Validate phone uniqueness against `staff` table
2. Auto-generate `username` = `first_name.toLowerCase() + phone.slice(-4)` (ensure unique, increment suffix if collision)
3. Auto-generate temp password (8-char alphanumeric random)
4. `bcrypt.hash(tempPassword, BCRYPT_ROUNDS)`
5. Insert user record (role = 'STAFF', force_password_change = true)
6. Insert staff record (with `user_id` = new user's id)
7. Insert first `commission_rate_history` (effective_from = join_date, effective_to = null)

Response includes generated credentials plaintext (one-time only):
```json
{ "success": true, "data": { "staff": {...}, "credentials": { "username": "ravi4210", "temporaryPassword": "Ab7@mX2p" } } }
```

### 6.3 — PUT `/api/staff/:id/commission` — Update Commission

```javascript
// New commission effective from tomorrow (not today)
const effectiveFrom = new Date();
effectiveFrom.setDate(effectiveFrom.getDate() + 1);

BEGIN;
  -- Close the current rate record
  UPDATE commission_rate_history 
  SET effective_to = $effectiveFrom - 1 day
  WHERE staff_id = $staffId AND effective_to IS NULL;
  
  -- Insert new rate record
  INSERT INTO commission_rate_history (staff_id, commission_pct, effective_from, changed_by)
  VALUES ($staffId, $newRate, $effectiveFrom, $currentUserId);
  
  -- Update current rate on staff record for quick access
  UPDATE staff SET commission_pct = $newRate, updated_at = NOW() WHERE id = $staffId;
COMMIT;
```

### 6.4 — Commission Calculation Engine

**File:** `src/utils/commission.js`

```javascript
async function getCommissionRateOnDate(staffId, serviceDate, db) {
  const { rows } = await db.query(`
    SELECT commission_pct FROM commission_rate_history
    WHERE staff_id = $1
      AND effective_from <= $2
      AND (effective_to IS NULL OR effective_to >= $2)
    ORDER BY effective_from DESC
    LIMIT 1
  `, [staffId, serviceDate]);
  return rows[0]?.commission_pct ?? 0;
}
```

### 6.5 — GET `/api/staff/:id/performance`

Query params: `?start_date=2026-06-01&end_date=2026-06-17`

SQL:
```sql
SELECT
  ili.professional_id,
  ili.professional_name_snap,
  i.invoice_date,
  ili.service_name_snap,
  ili.unit_price_snap,
  crh.commission_pct
FROM invoice_line_items ili
JOIN invoices i ON i.id = ili.invoice_id
  AND i.status = 'PAID'
  AND i.invoice_date BETWEEN $start AND $end
-- Exclude refunded line items
LEFT JOIN refunds r ON r.invoice_id = i.id
-- Get commission rate in effect on service date
JOIN LATERAL (
  SELECT commission_pct FROM commission_rate_history
  WHERE staff_id = $staffId
    AND effective_from <= i.invoice_date
    AND (effective_to IS NULL OR effective_to >= i.invoice_date)
  ORDER BY effective_from DESC LIMIT 1
) crh ON true
WHERE ili.professional_id = $staffId
  AND r.id IS NULL   -- exclude refunded invoices
ORDER BY i.invoice_date;
```

Service layer aggregates the raw rows into:
```json
{
  "summary": { "total_services": 42, "total_revenue": 18400, "commission_earned": 2760, "avg_services_per_day": 2.5 },
  "by_rate_period": [
    { "rate": 12, "from": "2026-06-01", "to": "2026-06-14", "services": 28, "revenue": 11200, "commission": 1344 },
    { "rate": 15, "from": "2026-06-15", "to": "2026-06-17", "services": 14, "revenue": 7200, "commission": 1080 }
  ],
  "line_items": [ ... ]
}
```

---

## Milestone M7 — Owner Dashboard API

**File:** `src/routes/dashboard.routes.js`

### 7.1 — Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/dashboard/kpis` | Required | OWNER | All 5 KPI values for a date range |
| GET | `/api/dashboard/revenue-trend` | Required | OWNER | Daily revenue for rolling 30 days |
| GET | `/api/dashboard/category-split` | Required | OWNER | Revenue % by service category |
| GET | `/api/dashboard/top-services` | Required | OWNER | Top 5 services by revenue |
| GET | `/api/dashboard/staff-leaderboard` | Required | OWNER | All staff by revenue descending |
| GET | `/api/dashboard/birthdays` | Required | OWNER | Upcoming birthdays (next 7 days) |

### 7.2 — GET `/api/dashboard/kpis`

Query params: `?start_date=2026-06-17&end_date=2026-06-17`

Returns all KPIs in a single response (one DB round-trip):

```javascript
// Run in parallel using Promise.all
const [revenue, customers, lapsed, topPerformer, priorRevenue, priorCustomers] = await Promise.all([
  db.query(REVENUE_SQL, [start, end]),
  db.query(CUSTOMERS_SQL, [start, end]),
  db.query(LAPSED_SQL, [45]),
  db.query(TOP_PERFORMER_SQL, [start, end]),
  db.query(REVENUE_SQL, [priorStart, priorEnd]),   // for WoW
  db.query(CUSTOMERS_SQL, [priorStart, priorEnd]),  // for WoW
]);

const todayRevenue = revenue.rows[0].total ?? 0;
const priorRevTotal = priorRevenue.rows[0].total ?? 0;
const wowRevPct = priorRevTotal > 0
  ? ((todayRevenue - priorRevTotal) / priorRevTotal * 100).toFixed(1)
  : null;
```

Response:
```json
{
  "success": true,
  "data": {
    "revenue": { "value": 12400, "wow_pct": 23.4, "wow_direction": "up" },
    "customers_served": { "total": 18, "new": 12, "returning": 6, "wow_change": 4 },
    "average_ticket_value": { "value": 688.89, "wow_pct": 8.2, "wow_direction": "up" },
    "lapsed_customers": { "count": 7, "wow_change": 2 },
    "top_performer": { "staff_id": "uuid", "name": "Ravi", "revenue": 4200, "service_count": 9 }
  }
}
```

### 7.3 — GET `/api/dashboard/revenue-trend`

Always returns rolling last 30 calendar days (ignores date filter):

```sql
SELECT
  generate_series(
    CURRENT_DATE - INTERVAL '29 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS day,
  COALESCE(SUM(i.grand_total), 0) AS revenue
FROM generate_series(...)
LEFT JOIN invoices i
  ON i.invoice_date = generate_series.day AND i.status = 'PAID'
GROUP BY day
ORDER BY day;
```

Generates a full 30-day series with 0 on days with no transactions (no gaps in chart).

### 7.4 — GET `/api/dashboard/category-split`

```sql
SELECT sc.name AS category, COALESCE(SUM(ili.unit_price_snap), 0) AS revenue
FROM service_categories sc
LEFT JOIN services s ON s.category_id = sc.id
LEFT JOIN invoice_line_items ili ON ili.service_id = s.id
LEFT JOIN invoices i ON i.id = ili.invoice_id
  AND i.status = 'PAID'
  AND i.invoice_date BETWEEN $1 AND $2
  -- Exclude refunded invoices
  AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = i.id)
GROUP BY sc.id, sc.name
ORDER BY revenue DESC;
```

### 7.5 — GET `/api/dashboard/birthdays`

Always returns next 7 days (filter-independent):

```sql
SELECT id, name, phone, date_of_birth,
  MAKE_DATE(
    EXTRACT(YEAR FROM CURRENT_DATE)::int,
    EXTRACT(MONTH FROM date_of_birth)::int,
    EXTRACT(DAY FROM date_of_birth)::int
  ) AS birthday_this_year
FROM customers
WHERE status = 'ACTIVE'
  AND MAKE_DATE(
    EXTRACT(YEAR FROM CURRENT_DATE)::int,
    EXTRACT(MONTH FROM date_of_birth)::int,
    EXTRACT(DAY FROM date_of_birth)::int
  ) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY birthday_this_year;
```

Handles year-boundary (Dec 31 → Jan 1) by checking both current year and next year.

---

## Milestone M8 — Settings API

**File:** `src/routes/settings.routes.js`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/settings/salon` | Required | OWNER | Get salon profile |
| PUT | `/api/settings/salon` | Required | OWNER | Update salon profile |
| GET | `/api/settings/discounts` | Required | OWNER, BILLING | List discount offers |
| POST | `/api/settings/discounts` | Required | OWNER | Create discount offer |
| PATCH | `/api/settings/discounts/:id/status` | Required | OWNER | Activate/deactivate offer |

**Users endpoints** (in `src/routes/users.routes.js`):

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/users` | Required | OWNER | List all users |
| POST | `/api/users` | Required | OWNER | Create user |
| PATCH | `/api/users/:id/status` | Required | OWNER | Deactivate user |
| POST | `/api/users/:id/reset-password` | Required | OWNER | Reset password |

**PATCH `/api/users/:id/status` — Deactivate:**
- Block if `id = req.user.id` → 400 "Cannot deactivate your own account"
- On deactivate: update status = 'INACTIVE'; any active JWT for that user will fail next request (user will not be returned from active check)

---

## Milestone M9 — Sync Engine

**File:** `src/services/sync.service.js`

The sync engine processes records that were created offline (with LOCAL invoice numbers) and reconciles them into the canonical format.

### 9.1 — POST `/api/sync/push`

The frontend sends batched PENDING records when coming online:

```json
{
  "device_id": "abc-123",
  "records": [
    { "entity_type": "customer", "operation": "CREATE", "local_id": "LOCAL-...", "payload": { ... } },
    { "entity_type": "invoice",  "operation": "CREATE", "local_id": "LOCAL-...", "payload": { ... } }
  ]
}
```

Processing per record:
1. Attempt to apply the record (INSERT or UPDATE)
2. Conflict detection:
   - Customer: phone already exists (ACTIVE) → flag as CONFLICT
   - Invoice: no conflicts (LOCAL numbers always unique)
3. Return result per record:
   ```json
   { "local_id": "LOCAL-...", "server_id": "uuid", "canonical_number": "SAL-202607-0043", "status": "PROCESSED" }
   ```

### 9.2 — GET `/api/sync/pull`

Frontend pulls any updates made on other devices since last sync:

Query param: `?since=<ISO_timestamp>&device_id=<device_id>`

Returns all records updated after `since` that were NOT created by this device:
```json
{
  "customers": [...updated/created since last sync...],
  "services": [...],
  "staff": [...],
  "invoices": [...],
  "last_sync_timestamp": "2026-06-17T14:32:00Z"
}
```

Frontend applies these records to its local IndexedDB (last-write-wins at field level).

### 9.3 — Conflict Resolution

For customer phone conflicts:
- Server marks the second record as CONFLICT in sync_queue
- Owner is notified via next API pull: `{ "conflicts": [{ "type": "DUPLICATE_PHONE", "local_id": "...", "existing_customer_id": "...", "message": "Phone 9876543210 already exists. Merge required." }] }`

---

## Milestone M10 — Security Hardening

### 10.1 — Express Middleware Stack (order matters)

```javascript
// src/app.js
app.use(helmet());                    // Security headers
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));          // HTTP request logging

// Routes
app.post('/api/auth/login', loginRateLimiter, authRoutes);
app.use('/api', authenticate);        // JWT required for all /api/* except /auth/login
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
// ... all other routes ...

app.use(errorHandler);               // Global error handler (must be last)
```

### 10.2 — Input Validation on Every Endpoint

All request bodies validated with Zod before reaching controller. Invalid requests return:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [{ "field": "price", "message": "Expected number, received string" }] }}
```

### 10.3 — SQL Injection Prevention

- All queries use parameterised queries (`$1, $2, ...`) — never string concatenation
- No dynamic table names or column names constructed from user input

### 10.4 — Sensitive Data Rules

- Passwords: never logged, never returned in API responses
- Commission %: never returned to BILLING_PERSON or STAFF in API responses (service layer filters)
- Customer phone: partially masked in staff-accessible contexts

### 10.5 — Rate Limiting

| Endpoint | Limit |
|---|---|
| POST `/api/auth/login` | 5 per 15 minutes per IP |
| POST `/api/invoices` | 60 per minute per user |
| POST `/api/sync/push` | 10 per minute per device |
| All other endpoints | 200 per minute per user |

---

## Milestone M11 — Testing

### 11.1 — Unit Tests (`tests/unit/`)

**Invoice Number Generator:**
```javascript
test('generates SAL-YYYYMM-NNNN format', async () => {
  const num = await generateInvoiceNumber(mockDb);
  expect(num).toMatch(/^SAL-\d{6}-\d{4}$/);
});
```

**Commission Calculator:**
```javascript
test('uses rate in effect on service date', async () => {
  // Rate was 10% until Jun 14; 15% from Jun 15
  const rate = await getCommissionRateOnDate(staffId, '2026-06-10', mockDb);
  expect(rate).toBe(10);
  const rate2 = await getCommissionRateOnDate(staffId, '2026-06-16', mockDb);
  expect(rate2).toBe(15);
});

test('uses prior rate on rate-change date itself', async () => {
  // Rate changed on Jun 15 (effective from = Jun 16)
  const rate = await getCommissionRateOnDate(staffId, '2026-06-15', mockDb);
  expect(rate).toBe(10);  // Still old rate on change day
});
```

**Dashboard KPI Service:**
```javascript
test('WoW returns null when prior period is zero', () => {
  const wow = calculateWoW(1200, 0);
  expect(wow).toBeNull();  // not Infinity
});

test('ATV returns null when customers = 0', () => {
  expect(calculateATV(0, 0)).toBeNull();
});
```

**Invoice Calculation Engine:**
```javascript
test('GST calculated on post-discount amount only', () => {
  const result = calculateInvoiceTotals({
    lineItems: [{ price: 1000 }],
    discountType: 'PERCENTAGE',
    discountValue: 10,
    gstEnabled: true
  });
  expect(result.taxableAmount).toBe(900);
  expect(result.cgst).toBe(81);
  expect(result.sgst).toBe(81);
  expect(result.grandTotal).toBe(1062);
});
```

### 11.2 — Integration Tests (`tests/integration/`)

Setup: test database with fresh schema + seed data before each test suite.

**Auth Tests:**
```javascript
describe('POST /api/auth/login', () => {
  it('returns JWT on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('locks account after 5 failures', async () => {
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ username: 'billing1', password: 'wrong' });
    const res = await request(app).post('/api/auth/login').send({ username: 'billing1', password: 'Correct@1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/locked/i);
  });
});
```

**RBAC Tests:**
```javascript
describe('RBAC enforcement', () => {
  it('returns 403 when BILLING_PERSON accesses /api/staff', async () => {
    const token = await loginAs('billing1');
    const res = await request(app).get('/api/staff').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when STAFF accesses /api/dashboard/kpis', async () => {
    const token = await loginAs('ravi');
    const res = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

**Invoice Creation Test:**
```javascript
it('creates invoice with correct server-calculated totals', async () => {
  const token = await loginAs('billing1');
  const res = await request(app)
    .post('/api/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({ customer_id, payment_method: 'UPI', discount_type: 'PERCENTAGE', discount_value: 10,
            line_items: [{ service_id, service_name_snap: 'Haircut', unit_price_snap: 1000, professional_id }] });
  expect(res.status).toBe(201);
  expect(res.body.data.subtotal).toBe(1000);
  expect(res.body.data.taxable_amount).toBe(900);
  expect(res.body.data.grand_total).toBe(1062);
  expect(res.body.data.invoice_number).toMatch(/^SAL-/);
});
```

### 11.3 — Test Coverage Targets

| Area | Target |
|---|---|
| Service layer (business logic) | 90%+ |
| API route handlers (integration) | 85%+ |
| RBAC enforcement | 100% (every role × every endpoint) |
| Commission calculation edge cases | 100% |
| Invoice calculation engine | 100% |

---

## Milestone M12 — Frontend Integration (Connecting Frontend to Backend)

After the backend API is complete and all tests pass, update the frontend to use real API calls.

### 12.1 — API Client Module

Create **`js/api.js`** in the frontend:

```javascript
const BASE_URL = 'https://your-backend-url.com/api';

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('salon_token');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!data.success) throw new APIError(data.error);
  return data.data;
}

export const api = {
  auth: {
    login: (credentials) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    me: () => apiFetch('/auth/me'),
    changePassword: (body) => apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  },
  customers: {
    search: (params) => apiFetch(`/customers?${new URLSearchParams(params)}`),
    create: (data) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => apiFetch(`/customers/${id}`),
    update: (id, data) => apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  invoices: {
    create: (data) => apiFetch('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    list: (params) => apiFetch(`/invoices?${new URLSearchParams(params)}`),
    get: (id) => apiFetch(`/invoices/${id}`),
    refund: (id, data) => apiFetch(`/invoices/${id}/refund`, { method: 'POST', body: JSON.stringify(data) }),
  },
  // ... all other modules
};
```

### 12.2 — Replacement Strategy: Dexie → API

Replace Dexie helper calls in each page module with `api.*` calls:

| Old (Dexie) | New (API) |
|---|---|
| `findCustomerByPhone(phone)` | `api.customers.search({ phone })` |
| `createCustomer(data)` | `api.customers.create(data)` |
| `createInvoice(inv, items)` | `api.invoices.create({ ...inv, line_items: items })` |
| `getStaffPerformance(id, start, end)` | `api.staff.performance(id, { start_date: start, end_date: end })` |
| `getDashboardKPIs(start, end)` | `api.dashboard.kpis({ start_date: start, end_date: end })` |

Dexie.js stays in the codebase for **offline caching only**:
- On API success: write result to Dexie (local cache)
- On network failure: read from Dexie cache (stale-while-revalidate)

### 12.3 — Auth Flow Update

Replace simulated auth with real JWT:
```javascript
// Old: compare password against Dexie hash
// New:
async function login(username, password) {
  const { token, user, forcePasswordChange } = await api.auth.login({ username, password });
  sessionStorage.setItem('salon_token', token);
  setSession(user);
  return { forcePasswordChange };
}
```

Remove: simulated lockout from localStorage (now handled server-side).
Keep: session timeout interval (frontend UX, still client-side).

### 12.4 — Integration Testing (Full Stack)

After connecting frontend to backend:

- [ ] Login with real credentials → JWT received → dashboard loads
- [ ] Create customer via frontend → appears in PostgreSQL immediately
- [ ] Create invoice → canonical SAL number returned by server
- [ ] Refund → status updates in PostgreSQL
- [ ] Offline: frontend falls back to Dexie cache; offline banner shown
- [ ] Online after offline: sync pushes pending records to `/api/sync/push`
- [ ] Dashboard KPIs: verify values match direct PostgreSQL COUNT/SUM queries

---

## Milestone M13 — Deployment

### 13.1 — Environment Setup

**Database (Supabase):**
1. Create a new Supabase project at supabase.com
2. Go to Settings → Database → Connection string → copy the **Session mode** pooler URI (port 5432)
3. Open the Supabase SQL Editor and run `db/schema.sql` in full
4. Optionally run seed SQL to populate initial data

**Backend deployment (Railway or Render):**
1. Push code to GitHub repository
2. Connect Railway/Render to the GitHub repository
3. Set environment variables in the platform dashboard (copy from `.env.example`)
   - Set `DATABASE_URL` to the Supabase pooler connection string from step 2 above
4. Set start command: `node src/server.js`
5. Enable auto-deploy on push to `main` branch

**Frontend deployment (Vercel or Netlify):**
1. Update `BASE_URL` in `js/api.js` to the backend's deployed URL
2. Deploy the `Salon Application/` folder as a static site
3. Configure CORS: add the Vercel/Netlify URL to `ALLOWED_ORIGINS` env var on backend

### 13.2 — Pre-Deployment Checklist

- [ ] All environment variables set (no hardcoded secrets in code)
- [ ] `NODE_ENV=production` set on server
- [ ] `db/schema.sql` successfully executed in Supabase SQL Editor (check for errors)
- [ ] `DATABASE_URL` points to Supabase pooler connection string
- [ ] Seed data applied
- [ ] `npm test` passes with 0 failures
- [ ] `GET /health` returns 200 on deployed URL
- [ ] HTTPS enforced (Railway/Render and Supabase both provide SSL automatically)
- [ ] CORS configured for production frontend URL only

---

## Backend Completion Checklist

### API Coverage
- [ ] All endpoints from all modules implemented and tested
- [ ] All RBAC rules enforced at middleware level (not just UI)
- [ ] All server-side calculations verified (totals never trusted from client)
- [ ] All Zod validation schemas cover every request body

### Data Integrity
- [ ] All foreign key constraints enforced in PostgreSQL schema
- [ ] Invoice numbers use PostgreSQL sequence (no race conditions)
- [ ] Commission rates correctly segmented by effective date in reports
- [ ] Refunded invoices excluded from all revenue/commission calculations
- [ ] Soft deletes only: no hard DELETE on customers, staff, invoices, or refunds

### Security
- [ ] No raw SQL string interpolation (parameterised queries throughout)
- [ ] Commission % never returned to BILLING_PERSON or STAFF roles
- [ ] Passwords never logged or returned in responses
- [ ] Rate limiting active on login endpoint
- [ ] Helmet.js security headers applied

### Testing
- [ ] Unit test coverage ≥ 85%
- [ ] Integration tests: every endpoint tested
- [ ] RBAC matrix: every role × every endpoint tested
- [ ] Commission calculation edge cases: all 10 PRD edge cases verified
- [ ] Invoice calculation: all edge cases (₹0 service, discount > subtotal guard, GST enabled/disabled)

---

*Backend Implementation Plan v1.0 — Salon Management Web App — June 2026*
*Pre-condition: Frontend Implementation Plan (`implementation_plan_frontend.md`) complete and all M10 tests passing.*
