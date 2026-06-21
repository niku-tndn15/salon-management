-- Baseline seed data for local development and Supabase smoke testing.
-- Password for seeded users: Admin@123

DO $$
DECLARE
  owner_id UUID;
  billing1_id UUID;
  billing2_id UUID;
  staff_user_id UUID;
  hair_id UUID;
  skin_id UUID;
  nails_id UUID;
  spa_id UUID;
  bridal_id UUID;
  service_count INTEGER;
  staff_count INTEGER;
  customer_count INTEGER;
BEGIN
  INSERT INTO salon_profile (name, address, phone, gst_enabled, gstin)
  SELECT 'Salon App', 'Main Market Road, Mumbai', '9876543210', FALSE, NULL
  WHERE NOT EXISTS (SELECT 1 FROM salon_profile);

  INSERT INTO users (username, password_hash, full_name, role, force_password_change)
  VALUES ('owner', '$2a$12$kSbTKQXsz2oNHf9V/RUXDOjzSATJwVm7Sh27T4NOdG.4w2Ko3P86m', 'Salon Owner', 'OWNER', FALSE)
  ON CONFLICT (username) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = 'ACTIVE',
      updated_at = NOW()
  RETURNING id INTO owner_id;

  INSERT INTO users (username, password_hash, full_name, role, force_password_change)
  VALUES ('billing1', '$2a$12$kSbTKQXsz2oNHf9V/RUXDOjzSATJwVm7Sh27T4NOdG.4w2Ko3P86m', 'Billing User One', 'BILLING_PERSON', FALSE)
  ON CONFLICT (username) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = 'ACTIVE',
      updated_at = NOW()
  RETURNING id INTO billing1_id;

  INSERT INTO users (username, password_hash, full_name, role, force_password_change)
  VALUES ('billing2', '$2a$12$kSbTKQXsz2oNHf9V/RUXDOjzSATJwVm7Sh27T4NOdG.4w2Ko3P86m', 'Billing User Two', 'BILLING_PERSON', FALSE)
  ON CONFLICT (username) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = 'ACTIVE',
      updated_at = NOW()
  RETURNING id INTO billing2_id;

  INSERT INTO users (username, password_hash, full_name, role, force_password_change)
  VALUES ('ravi', '$2a$12$kSbTKQXsz2oNHf9V/RUXDOjzSATJwVm7Sh27T4NOdG.4w2Ko3P86m', 'Ravi Kumar', 'STAFF', FALSE)
  ON CONFLICT (username) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = 'ACTIVE',
      updated_at = NOW()
  RETURNING id INTO staff_user_id;

  INSERT INTO service_categories (name) VALUES ('Hair')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO hair_id FROM service_categories WHERE name = 'Hair';

  INSERT INTO service_categories (name) VALUES ('Skin')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO skin_id FROM service_categories WHERE name = 'Skin';

  INSERT INTO service_categories (name) VALUES ('Nails')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO nails_id FROM service_categories WHERE name = 'Nails';

  INSERT INTO service_categories (name) VALUES ('Spa')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO spa_id FROM service_categories WHERE name = 'Spa';

  INSERT INTO service_categories (name) VALUES ('Bridal')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO bridal_id FROM service_categories WHERE name = 'Bridal';

  INSERT INTO services (name, category_id, price, duration_minutes, description, created_by)
  SELECT service_name, category_id, price, duration_minutes, description, owner_id
  FROM (
    VALUES
      ('Haircut', hair_id, 500.00, 30, 'Classic haircut and styling'),
      ('Hair Spa', hair_id, 1200.00, 60, 'Hydrating hair spa treatment'),
      ('Hair Color', hair_id, 2500.00, 120, 'Global hair color service'),
      ('Facial', skin_id, 1500.00, 60, 'Deep cleansing facial'),
      ('Cleanup', skin_id, 800.00, 40, 'Quick skin cleanup'),
      ('Threading', skin_id, 150.00, 15, 'Eyebrow threading'),
      ('Manicure', nails_id, 700.00, 45, 'Classic manicure'),
      ('Pedicure', nails_id, 900.00, 50, 'Classic pedicure'),
      ('Gel Polish', nails_id, 1100.00, 45, 'Long-lasting gel polish'),
      ('Body Massage', spa_id, 2200.00, 90, 'Full body relaxation massage'),
      ('Head Massage', spa_id, 600.00, 30, 'Oil head massage'),
      ('Bridal Makeup', bridal_id, 7500.00, 180, 'Complete bridal makeup')
  ) AS seed(service_name, category_id, price, duration_minutes, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE LOWER(services.name) = LOWER(seed.service_name)
  );

  INSERT INTO staff (user_id, name, phone, designation, commission_pct, join_date)
  VALUES
    (staff_user_id, 'Ravi Kumar', '9000000001', 'Senior Hair Stylist', 12.50, CURRENT_DATE - INTERVAL '2 years'),
    (NULL, 'Anita Sharma', '9000000002', 'Skin Specialist', 10.00, CURRENT_DATE - INTERVAL '18 months'),
    (NULL, 'Meera Patel', '9000000003', 'Nail Artist', 8.00, CURRENT_DATE - INTERVAL '1 year'),
    (NULL, 'Karan Mehta', '9000000004', 'Spa Therapist', 9.50, CURRENT_DATE - INTERVAL '10 months')
  ON CONFLICT (phone) DO UPDATE
  SET name = EXCLUDED.name,
      designation = EXCLUDED.designation,
      commission_pct = EXCLUDED.commission_pct,
      status = 'ACTIVE',
      updated_at = NOW();

  INSERT INTO commission_rate_history (staff_id, commission_pct, effective_from, changed_by)
  SELECT s.id, s.commission_pct, s.join_date, owner_id
  FROM staff s
  WHERE s.phone IN ('9000000001', '9000000002', '9000000003', '9000000004')
    AND NOT EXISTS (
      SELECT 1 FROM commission_rate_history crh
      WHERE crh.staff_id = s.id AND crh.effective_to IS NULL
    );

  INSERT INTO predefined_discount_offers (name, discount_type, discount_value)
  VALUES
    ('New Customer Welcome', 'PERCENTAGE', 10.00),
    ('Festive Flat Discount', 'FLAT', 250.00),
    ('Premium Service Offer', 'PERCENTAGE', 15.00)
  ON CONFLICT (LOWER(name)) WHERE status = 'ACTIVE' DO UPDATE
  SET discount_type = EXCLUDED.discount_type,
      discount_value = EXCLUDED.discount_value,
      updated_at = NOW();

  INSERT INTO customers (name, phone, gender, date_of_birth, referral_source, notes, created_by)
  SELECT customer_name, phone, gender, date_of_birth, referral_source, notes, billing1_id
  FROM (
    VALUES
      ('Priya Nair', '8880000001', 'FEMALE', DATE '1994-03-12', 'INSTAGRAM', 'Prefers evening appointments'),
      ('Amit Shah', '8880000002', 'MALE', DATE '1988-07-21', 'GOOGLE', 'Regular haircut customer'),
      ('Sneha Rao', '8880000003', 'FEMALE', DATE '1991-11-05', 'FRIEND_REFERRAL', 'Interested in skin packages'),
      ('Rahul Verma', '8880000004', 'MALE', DATE '1985-01-18', 'WALK_IN', 'Prefers UPI payments'),
      ('Neha Jain', '8880000005', 'FEMALE', DATE '1997-09-30', 'FACEBOOK', 'Nail art customer'),
      ('Isha Kapoor', '8880000006', 'FEMALE', DATE '1990-05-14', 'INSTAGRAM', 'Bridal inquiry'),
      ('Vikram Singh', '8880000007', 'MALE', DATE '1982-12-09', 'OTHER', 'Spa customer'),
      ('Farah Khan', '8880000008', 'FEMALE', DATE '1995-08-26', 'GOOGLE', 'Likes discount offers')
  ) AS seed(customer_name, phone, gender, date_of_birth, referral_source, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.phone = seed.phone AND c.status = 'ACTIVE'
  );

  SELECT COUNT(*) INTO service_count FROM services;
  SELECT COUNT(*) INTO staff_count FROM staff WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO customer_count FROM customers WHERE status = 'ACTIVE';

  IF service_count >= 12 AND staff_count >= 4 AND customer_count >= 8 THEN
    CREATE TEMP TABLE IF NOT EXISTS seed_invoice_rows (
      row_num INTEGER PRIMARY KEY,
      invoice_number VARCHAR(30) NOT NULL,
      invoice_date DATE NOT NULL,
      customer_id UUID NOT NULL,
      created_by UUID NOT NULL,
      payment_method VARCHAR(10) NOT NULL,
      service_id UUID NOT NULL,
      service_name VARCHAR(100) NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      staff_id UUID NOT NULL,
      staff_name VARCHAR(100) NOT NULL,
      staff_commission NUMERIC(5,2),
      discount_type VARCHAR(20) NOT NULL,
      discount_value NUMERIC(10,2) NOT NULL,
      discount_amount NUMERIC(10,2) NOT NULL,
      taxable_amount NUMERIC(10,2) NOT NULL,
      grand_total NUMERIC(10,2) NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO seed_invoice_rows
    SELECT
      gs AS row_num,
      'SAL-' || TO_CHAR(CURRENT_DATE - ((gs - 1) % 30), 'YYYYMM') || '-' || LPAD(gs::TEXT, 4, '0') AS invoice_number,
      CURRENT_DATE - ((gs - 1) % 30) AS invoice_date,
      c.id AS customer_id,
      CASE WHEN gs % 2 = 0 THEN billing1_id ELSE billing2_id END AS created_by,
      CASE WHEN gs % 3 = 0 THEN 'CARD' WHEN gs % 3 = 1 THEN 'UPI' ELSE 'CASH' END AS payment_method,
      svc.id AS service_id,
      svc.name AS service_name,
      svc.price AS unit_price,
      st.id AS staff_id,
      st.name AS staff_name,
      st.commission_pct AS staff_commission,
      CASE WHEN gs % 10 = 0 THEN 'FLAT' WHEN gs % 6 = 0 THEN 'PERCENTAGE' ELSE 'NONE' END AS discount_type,
      CASE WHEN gs % 10 = 0 THEN 100.00 WHEN gs % 6 = 0 THEN 10.00 ELSE 0.00 END AS discount_value,
      CASE WHEN gs % 10 = 0 THEN LEAST(100.00, svc.price) WHEN gs % 6 = 0 THEN ROUND(svc.price * 0.10, 2) ELSE 0.00 END AS discount_amount,
      svc.price - CASE WHEN gs % 10 = 0 THEN LEAST(100.00, svc.price) WHEN gs % 6 = 0 THEN ROUND(svc.price * 0.10, 2) ELSE 0.00 END AS taxable_amount,
      svc.price - CASE WHEN gs % 10 = 0 THEN LEAST(100.00, svc.price) WHEN gs % 6 = 0 THEN ROUND(svc.price * 0.10, 2) ELSE 0.00 END AS grand_total
    FROM generate_series(1, 120) AS gs
    JOIN LATERAL (
      SELECT id FROM customers WHERE status = 'ACTIVE' ORDER BY phone OFFSET ((gs - 1) % 8) LIMIT 1
    ) c ON TRUE
    JOIN LATERAL (
      SELECT id, name, price FROM services WHERE status = 'active' ORDER BY name OFFSET ((gs - 1) % 12) LIMIT 1
    ) svc ON TRUE
    JOIN LATERAL (
      SELECT id, name, commission_pct FROM staff WHERE status = 'ACTIVE' ORDER BY phone OFFSET ((gs - 1) % 4) LIMIT 1
    ) st ON TRUE
    ON CONFLICT (row_num) DO NOTHING;

    INSERT INTO invoices (
      invoice_number,
      customer_id,
      created_by,
      invoice_date,
      payment_method,
      subtotal,
      discount_type,
      discount_value,
      discount_amount,
      taxable_amount,
      gst_enabled,
      cgst_amount,
      sgst_amount,
      grand_total,
      status,
      salon_name_snap,
      salon_address_snap,
      salon_phone_snap
    )
    SELECT
      sir.invoice_number,
      sir.customer_id,
      sir.created_by,
      sir.invoice_date,
      sir.payment_method,
      sir.unit_price,
      sir.discount_type,
      sir.discount_value,
      sir.discount_amount,
      sir.taxable_amount,
      FALSE,
      0,
      0,
      sir.grand_total,
      'PAID',
      sp.name,
      sp.address,
      sp.phone
    FROM seed_invoice_rows sir
    CROSS JOIN LATERAL (SELECT name, address, phone FROM salon_profile LIMIT 1) sp
    WHERE NOT EXISTS (
      SELECT 1 FROM invoices i WHERE i.invoice_number = sir.invoice_number
    );

    INSERT INTO invoice_line_items (
      invoice_id,
      service_id,
      service_name_snap,
      unit_price_snap,
      is_price_override,
      quantity,
      professional_id,
      professional_name_snap,
      commission_pct_snap
    )
    SELECT
      i.id,
      sir.service_id,
      sir.service_name,
      sir.unit_price,
      FALSE,
      1,
      sir.staff_id,
      sir.staff_name,
      sir.staff_commission
    FROM seed_invoice_rows sir
    JOIN invoices i ON i.invoice_number = sir.invoice_number
    WHERE NOT EXISTS (
      SELECT 1 FROM invoice_line_items ili WHERE ili.invoice_id = i.id
    );

    PERFORM setval('invoice_seq', GREATEST((SELECT last_value FROM invoice_seq), 121), TRUE);
  END IF;
END $$;
