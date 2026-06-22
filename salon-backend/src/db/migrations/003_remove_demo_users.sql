-- Remove demo billing and staff login accounts seeded in 002.
-- Only the owner account is retained. Billing and staff accounts are
-- created by the owner through the app at runtime.
-- FK-safe: reassign owned records to the owner before deleting users.

DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM users WHERE username = 'owner';

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner account not found — cannot run cleanup migration safely.';
  END IF;

  -- Reassign ALL records owned by / referencing demo accounts to the owner
  -- before deleting them, so no NOT NULL foreign keys are violated.

  -- invoices.created_by (NOT NULL)
  UPDATE invoices
  SET created_by = owner_id
  WHERE created_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  -- customers.created_by (NOT NULL) and customers.updated_by (nullable)
  UPDATE customers
  SET created_by = owner_id
  WHERE created_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  UPDATE customers
  SET updated_by = owner_id
  WHERE updated_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  -- services.created_by (NOT NULL)
  UPDATE services
  SET created_by = owner_id
  WHERE created_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  -- commission_rate_history.changed_by (NOT NULL)
  UPDATE commission_rate_history
  SET changed_by = owner_id
  WHERE changed_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  -- refunds.processed_by (NOT NULL) — a refund was processed by a demo account on live
  UPDATE refunds
  SET processed_by = owner_id
  WHERE processed_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2', 'ravi'));

  -- Unlink staff login for ravi (staff profile stays, login is removed)
  UPDATE staff
  SET user_id = NULL
  WHERE user_id IN (SELECT id FROM users WHERE username = 'ravi');

  -- Delete demo login accounts
  DELETE FROM users WHERE username IN ('billing1', 'billing2', 'ravi');
END $$;
