-- Beta testing support: "Dummy login" button.
-- Each click creates the next sequential dummy account (dummy1, dummy2, ...)
-- with OWNER role and full access, and records the requester's IP / user-agent
-- so the owner can count how many people tried the beta.
--
-- Safety notes:
--   * Usernames are generated from an integer sequence (server-side), never from
--     client input, so there is no SQL-injection surface here.
--   * IP / user-agent are written via parameterized queries in the service layer.

-- Sequential counter for dummy usernames (dummy1, dummy2, ...).
CREATE SEQUENCE IF NOT EXISTS dummy_user_seq START 1;

-- Audit log of every dummy-login click.
CREATE TABLE IF NOT EXISTS dummy_login_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id),
  username   VARCHAR(50) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dummy_login_events_created ON dummy_login_events(created_at);
