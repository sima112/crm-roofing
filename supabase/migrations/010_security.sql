-- ─────────────────────────────────────────────────────────────────────────────
-- 010_security.sql
-- Password history + security events
-- ─────────────────────────────────────────────────────────────────────────────

-- Password history (last N hashed passwords per user to prevent reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hash       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_history_user_created
  ON password_history(user_id, created_at DESC);

ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- Only service-role can read/write (no user-facing policies)

-- ─────────────────────────────────────────────────────────────────────────────
-- Security events log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  -- event_type values:
  --   login_success, login_failed, password_changed,
  --   password_reset_requested, signup, account_locked
  email      text,
  ip_address text,
  user_agent text,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_user_created
  ON security_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_email_type_created
  ON security_events(email, event_type, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_owner_read" ON security_events;
CREATE POLICY "security_events_owner_read" ON security_events
  FOR SELECT USING (auth.uid() = user_id);
