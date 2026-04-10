-- ─────────────────────────────────────────────────────────────────────────────
-- 013_data_rights.sql
-- GDPR/CCPA data rights: deletion grace period + privacy request workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Account deletion grace period ────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS account_status         text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_cancel_token  text;

-- account_status values: active | pending_deletion | suspended

CREATE INDEX IF NOT EXISTS businesses_pending_deletion
  ON businesses(deletion_scheduled_at)
  WHERE account_status = 'pending_deletion';

-- ── Privacy requests (public — no login required) ────────────────────────────

CREATE TABLE IF NOT EXISTS privacy_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text NOT NULL,
  request_type text NOT NULL,
  -- request_type: access | correction | deletion | portability | opt_out
  status       text NOT NULL DEFAULT 'pending',
  -- status: pending | in_progress | completed
  notes        text,
  ip_address   text,
  acknowledged boolean NOT NULL DEFAULT false,
  due_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_requests_status_due
  ON privacy_requests(status, due_at);
CREATE INDEX IF NOT EXISTS privacy_requests_email
  ON privacy_requests(email);

ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert (no login required), no public read
DROP POLICY IF EXISTS "privacy_requests_insert" ON privacy_requests;
CREATE POLICY "privacy_requests_insert" ON privacy_requests
  FOR INSERT WITH CHECK (true);

-- ── Nightly hard-delete cron job ─────────────────────────────────────────────
-- Requires pg_cron extension. Enable in Supabase dashboard, then uncomment:

-- SELECT cron.schedule(
--   'hard-delete-accounts',
--   '0 2 * * *',   -- 2am UTC daily
--   $$
--     DELETE FROM auth.users
--     WHERE id IN (
--       SELECT owner_id FROM businesses
--       WHERE account_status = 'pending_deletion'
--         AND deletion_scheduled_at < now()
--     );
--   $$
-- );
