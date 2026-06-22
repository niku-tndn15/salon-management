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

  -- Reassign invoices created by demo billing accounts to owner
  UPDATE invoices
  SET created_by = owner_id
  WHERE created_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2'));

  -- Reassign customers created by demo billing accounts to owner
  UPDATE customers
  SET created_by = owner_id
  WHERE created_by IN (SELECT id FROM users WHERE username IN ('billing1', 'billing2'));

  -- Unlink staff login for ravi (staff profile stays, login is removed)
  UPDATE staff
  SET user_id = NULL
  WHERE user_id IN (SELECT id FROM users WHERE username = 'ravi');

  -- Delete demo login accounts
  DELETE FROM users WHERE username IN ('billing1', 'billing2', 'ravi');
END $$;
