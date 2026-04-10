-- ─────────────────────────────────────────────────────────────────────────────
-- 014_password_rotation.sql
-- Track last password change date for optional 90-day rotation policy
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- Backfill: treat account creation date as last password change for existing users
UPDATE businesses
SET password_changed_at = created_at
WHERE password_changed_at IS NULL;
