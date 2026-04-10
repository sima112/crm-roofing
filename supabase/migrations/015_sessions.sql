-- ─────────────────────────────────────────────────────────────────────────────
-- 015_sessions.sql
-- Login history, brute-force lockout tracking, and MFA backup codes
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Login history ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  success      boolean NOT NULL,
  ip_address   text,
  user_agent   text,
  country      text,
  city         text,
  device_type  text,   -- 'mobile' | 'desktop' | 'tablet' | 'unknown'
  browser      text,
  suspicious   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_history_user_created
  ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_history_email_created
  ON login_history(email, created_at DESC);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_history_owner_read" ON login_history;
CREATE POLICY "login_history_owner_read" ON login_history
  FOR SELECT USING (auth.uid() = user_id);

-- ── Brute-force lockout columns on businesses ─────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS login_locked_until    timestamptz,
  ADD COLUMN IF NOT EXISTS total_lockout_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_admin_review boolean NOT NULL DEFAULT false;

-- ── MFA backup codes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,   -- bcrypt hash of 8-char alphanumeric code
  used       boolean NOT NULL DEFAULT false,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_backup_codes_user
  ON mfa_backup_codes(user_id, used);

ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_backup_codes_owner" ON mfa_backup_codes;
CREATE POLICY "mfa_backup_codes_owner" ON mfa_backup_codes
  FOR ALL USING (auth.uid() = user_id);
