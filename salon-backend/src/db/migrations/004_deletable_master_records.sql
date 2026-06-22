-- Support permanent deletion of master records (customers, staff, services,
-- discount offers) while preserving invoice history.
--
-- Strategy: invoices and invoice_line_items already snapshot the human-readable
-- details (salon info, service/staff names). We add customer name/phone
-- snapshots and relax the foreign keys so a master record can be removed
-- without destroying or orphaning historical invoices.

-- ── 1. Default salon name + owner display name ───────────────────────────────
UPDATE salon_profile SET name = 'Glamour Salon' WHERE name = 'Salon App';
UPDATE users SET full_name = 'Samay Raina' WHERE username = 'owner';

-- ── 2. Customer name/phone snapshot on invoices ──────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name_snap  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone_snap VARCHAR(15);

UPDATE invoices i
SET customer_name_snap = c.name,
    customer_phone_snap = c.phone
FROM customers c
WHERE c.id = i.customer_id
  AND i.customer_name_snap IS NULL;

-- ── 3. invoices.customer_id becomes nullable, SET NULL on customer delete ─────
ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ── 4. invoices.discount_offer_id SET NULL when an offer is deleted ──────────
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_discount_offer_id_fkey;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_discount_offer_id_fkey
  FOREIGN KEY (discount_offer_id) REFERENCES predefined_discount_offers(id) ON DELETE SET NULL;

-- ── 5. invoice_line_items.service_id SET NULL when a service is deleted ──────
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_service_id_fkey;
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_line_items_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

-- ── 6. invoice_line_items.professional_id nullable, SET NULL on staff delete ─
ALTER TABLE invoice_line_items ALTER COLUMN professional_id DROP NOT NULL;
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_professional_id_fkey;
ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_line_items_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES staff(id) ON DELETE SET NULL;
