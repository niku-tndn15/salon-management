-- PostgreSQL schema for Salon Application V1
-- Canonical source of truth for database structure.
-- docs/implementation_plan_backend.md schema snippet must match this file exactly.
-- Conventions:
--   All PKs named `id` (UUID) — entity IDs in API responses use descriptive aliases
--   Soft deletes via status column (no deleted_at); sync via sync_queue table
--   Monetary values NUMERIC(10,2); percentage rates NUMERIC(5,2)
--   VARCHAR CHECK constraints (not ENUMs) for portability

-- ─── EXTENSION ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── SEQUENCES ───────────────────────────────────────────────────────────────
CREATE SEQUENCE invoice_seq START 1;   -- SAL-YYYYMM-NNNN
CREATE SEQUENCE refund_seq  START 1;   -- REF-YYYYMM-NNNN

-- ─── SALON PROFILE (single row per deployment) ───────────────────────────────
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

-- ─── USERS ───────────────────────────────────────────────────────────────────
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

-- ─── SERVICE CATEGORIES ──────────────────────────────────────────────────────
CREATE TABLE service_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SERVICES ────────────────────────────────────────────────────────────────
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  category_id      UUID NOT NULL REFERENCES service_categories(id),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes >= 1),
  description      TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_service_name_lower ON services (LOWER(name));

-- ─── STAFF ───────────────────────────────────────────────────────────────────
CREATE TABLE staff (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID UNIQUE REFERENCES users(id),  -- linked STAFF login account
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

-- Commission rate history; current rate = row WHERE effective_to IS NULL
CREATE TABLE commission_rate_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id       UUID NOT NULL REFERENCES staff(id),
  commission_pct NUMERIC(5,2) NOT NULL CHECK (commission_pct BETWEEN 0 AND 100),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  changed_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(10) NOT NULL,
  gender          VARCHAR(20) NOT NULL CHECK (gender IN ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')),
  date_of_birth   DATE NOT NULL CHECK (date_of_birth < CURRENT_DATE),
  referral_source VARCHAR(30) NOT NULL CHECK (referral_source IN ('WALK_IN','FRIEND_REFERRAL','INSTAGRAM','GOOGLE','FACEBOOK','OTHER')),
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','MERGED','DELETED')),
  merged_into_id  UUID REFERENCES customers(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  updated_by      UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX uq_active_customer_phone ON customers(phone) WHERE status = 'ACTIVE';

-- ─── PREDEFINED DISCOUNT OFFERS ──────────────────────────────────────────────
CREATE TABLE predefined_discount_offers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100) NOT NULL,
  discount_type  VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE','FLAT')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pct_max CHECK (discount_type != 'PERCENTAGE' OR discount_value <= 100)
);
CREATE UNIQUE INDEX uq_active_offer_name ON predefined_discount_offers(LOWER(name)) WHERE status = 'ACTIVE';

-- ─── INVOICES ────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number      VARCHAR(30) UNIQUE NOT NULL,         -- SAL-YYYYMM-NNNN
  customer_id         UUID NOT NULL REFERENCES customers(id),
  created_by          UUID NOT NULL REFERENCES users(id),
  invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method      VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','UPI','CARD')),
  -- Monetary breakdown (all server-calculated; never trusted from client)
  subtotal            NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  discount_type       VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (discount_type IN ('NONE','PERCENTAGE','FLAT')),
  discount_value      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_offer_id   UUID REFERENCES predefined_discount_offers(id),
  discount_offer_snap TEXT,                                -- offer name snapshotted at billing time
  taxable_amount      NUMERIC(10,2) NOT NULL CHECK (taxable_amount >= 0),
  gst_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  cgst_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  grand_total         NUMERIC(10,2) NOT NULL CHECK (grand_total >= 0),
  status              VARCHAR(30) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID','REFUNDED','PARTIALLY_REFUNDED')),
  -- Salon info snapshotted at billing time (invoice must be printable even if salon settings change)
  gstin_snap          VARCHAR(15),
  salon_name_snap     TEXT NOT NULL,
  salon_address_snap  TEXT NOT NULL,
  salon_phone_snap    VARCHAR(15) NOT NULL
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_date     ON invoices(invoice_date);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_invoices_payment  ON invoices(payment_method);

-- ─── INVOICE LINE ITEMS ───────────────────────────────────────────────────────
CREATE TABLE invoice_line_items (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id             UUID REFERENCES services(id),         -- NULL if service later deleted
  service_name_snap      VARCHAR(100) NOT NULL,                -- snapshotted at billing time
  unit_price_snap        NUMERIC(10,2) NOT NULL CHECK (unit_price_snap >= 0),
  is_price_override      BOOLEAN NOT NULL DEFAULT FALSE,       -- true if price was manually changed
  quantity               INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  professional_id        UUID NOT NULL REFERENCES staff(id),
  professional_name_snap VARCHAR(100) NOT NULL,                -- snapshotted at billing time
  commission_pct_snap    NUMERIC(5,2)                          -- rate in effect at billing time
);

CREATE INDEX idx_line_items_invoice      ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_professional ON invoice_line_items(professional_id);
CREATE INDEX idx_line_items_service      ON invoice_line_items(service_id);

-- ─── REFUNDS ─────────────────────────────────────────────────────────────────
CREATE TABLE refunds (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_number  VARCHAR(30) UNIQUE NOT NULL,          -- REF-YYYYMM-NNNN
  invoice_id     UUID UNIQUE NOT NULL REFERENCES invoices(id),  -- one refund per invoice
  refund_type    VARCHAR(10) NOT NULL CHECK (refund_type IN ('FULL','PARTIAL')),
  refund_amount  NUMERIC(10,2) NOT NULL CHECK (refund_amount > 0),
  reason         TEXT NOT NULL,
  processed_by   UUID NOT NULL REFERENCES users(id),
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SYNC QUEUE (offline record backlog pushed from frontend IndexedDB) ───────
CREATE TABLE sync_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id       VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,      -- 'invoice', 'customer', 'refund'
  entity_id       UUID NOT NULL,
  operation       VARCHAR(20) NOT NULL CHECK (operation IN ('CREATE','UPDATE')),
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING','PROCESSED','CONFLICT')),
  processed_at    TIMESTAMPTZ,
  conflict_reason TEXT
);
