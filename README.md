# Salon Management App

A full-stack, browser-based salon management web application built for single-location Indian salons. It digitises the three most painful manual workflows at the billing counter: customer visit tracking, staff performance & commission management, and GST-compliant invoicing.

---

## Features

### For Owners
- **Dashboard** — real-time KPIs: revenue, visits, top services, staff leaderboard, lapsed customer alerts
- **Staff Management** — add/edit staff, set commission %, view individual performance by date range
- **Service Catalog** — create and manage services with prices and GST applicability
- **Settings** — business profile, GST toggle & GSTIN, predefined discount offers, user management

### For Billing Persons
- **Customer Management** — phone-first lookup, add/edit profiles, visit history, birthday alerts, referral tracking
- **Invoicing & Billing** — multi-professional bills, manual discounts (% or ₹), UPI/Cash/Card payment, refunds (full & partial), WhatsApp invoice sharing

### For Staff
- **My Performance** — personal service history and auto-calculated commission view

### Platform Capabilities
- Role-based access control (Owner / Billing Person / Staff)
- Offline-first with IndexedDB — works without internet
- Zero build step frontend — open `index.html` directly in a browser
- RESTful backend API with JWT authentication

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, ES6 Modules, CSS3 |
| Local DB | Dexie.js (IndexedDB wrapper) |
| Icons | Lucide (via CDN) |
| Charts | Chart.js (via CDN) |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 16 |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| Logging | Winston, Morgan |
| Security | Helmet, express-rate-limit |
| Testing | Jest, Supertest |

---

## Project Structure

```
salon-management-app/
├── index.html                    # SPA entry point (zero-build)
├── js/
│   ├── app.js                    # Bootstrap: DB init, session restore
│   ├── router.js                 # Hash-based router with RBAC gate
│   ├── auth.js                   # Session management, RBAC helpers
│   ├── db.js                     # Dexie schema + seed loader
│   ├── pages/
│   │   ├── login.js
│   │   ├── dashboard.js          # Owner only
│   │   ├── billing.js            # Owner + Billing Person
│   │   ├── customers.js          # Owner + Billing Person
│   │   ├── staff.js              # Owner mgmt + Staff self-view
│   │   ├── catalog.js            # Owner + Billing Person (read-only)
│   │   └── settings.js           # Owner only
│   └── components/
│       ├── sidebar.js, header.js, modal.js
│       ├── slideover.js, toast.js
├── css/                          # Design tokens + component styles
├── vendor/                       # Lucide, Dexie, Chart.js bundles
├── db/
│   └── schema.sql                # Canonical PostgreSQL schema
├── salon-backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/               # env.js, db.js
│   │   ├── middleware/           # auth, rbac, validate, rateLimiter, errorHandler
│   │   ├── routes/               # auth, customers, invoices, staff, catalog, dashboard, settings, sync
│   │   ├── controllers/          # one per resource
│   │   ├── services/             # business logic layer
│   │   ├── utils/                # httpError, commission, invoiceNumber, numbers
│   │   └── db/migrations/        # SQL migration files
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── master_prd.md
│   ├── openapi.yaml              # Full API contract
│   ├── implementation_plan_frontend.md
│   ├── implementation_plan_backend.md
│   └── acceptance_tests.md
└── seed/
    └── seed-data.json
```

---

## Getting Started

### Frontend (Zero Build)

1. Clone the repo and open `index.html` in Chrome, Firefox, or Edge.
2. On first load, the app seeds IndexedDB automatically.
3. Use demo credentials — password for all accounts: **`demo123`**

| Username  | Role          | Landing Page      |
|-----------|---------------|-------------------|
| `owner`   | Owner         | `/dashboard`      |
| `billing` | Billing Person| `/billing`        |
| `anita`   | Staff         | `/my-performance` |
| `ravi`    | Staff         | `/my-performance` |

### Backend

**Prerequisites:** Node.js >= 20, PostgreSQL 16

```bash
cd salon-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Run tests
npm test
```

The API will be available at `http://localhost:3000` (or the `PORT` set in `.env`).

---

## API Overview

Base path: `/api`

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` |
| Customers | `GET/POST /api/customers`, `GET/PUT /api/customers/:id` |
| Invoices | `GET/POST /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/refund` |
| Staff | `GET/POST /api/staff`, `GET/PUT /api/staff/:id`, `GET /api/staff/:id/performance` |
| Catalog | `GET/POST /api/catalog`, `PUT/DELETE /api/catalog/:id` |
| Dashboard | `GET /api/dashboard/summary` |
| Settings | `GET/PUT /api/settings` |
| Users | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` |
| Sync | `POST /api/sync` |
| Health | `GET /api/health` |

Full OpenAPI 3.0 spec: [`docs/openapi.yaml`](docs/openapi.yaml)

---

## Roles & Access

| Feature | Owner | Billing Person | Staff |
|---------|-------|---------------|-------|
| Owner Dashboard | Yes | No | No |
| Billing / Invoicing | Yes | Yes | No |
| Customer Management | Yes | Yes | No |
| Service Catalog | Yes | Read-only | No |
| Staff Management | Yes | No | No |
| My Performance | Yes | No | Own only |
| Settings | Yes | No | No |

---

## Key Documents

| File | Purpose |
|------|---------|
| [`docs/master_prd.md`](docs/master_prd.md) | Product requirements and key decisions |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Full API contract |
| [`db/schema.sql`](db/schema.sql) | PostgreSQL DDL — canonical source of truth |
| [`docs/acceptance_tests.md`](docs/acceptance_tests.md) | Manual test cases (AT-01 through AT-16) |
| [`docs/implementation_plan_backend.md`](docs/implementation_plan_backend.md) | Backend milestone plan |

---

## Environment Variables

Copy `salon-backend/.env.example` and fill in:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/salon_db
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=8h
NODE_ENV=development
```
