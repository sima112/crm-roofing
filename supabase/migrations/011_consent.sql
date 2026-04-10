-- ─────────────────────────────────────────────────────────────────────────────
-- 011_consent.sql
-- Consent management for GDPR/CCPA compliance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id  uuid REFERENCES businesses(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  -- consent_type values:
  --   terms_of_service | privacy_policy | marketing_emails
  --   analytics_tracking | sms_notifications | data_sharing
  version      text NOT NULL DEFAULT 'v1.0',
  granted      boolean NOT NULL,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  ip_address   text,
  user_agent   text,
  source       text NOT NULL DEFAULT 'signup',
  -- source values: signup | settings | cookie-banner
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_records_user_type
  ON consent_records(user_id, consent_type, updated_at DESC);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_records_owner" ON consent_records;
CREATE POLICY "consent_records_owner" ON consent_records
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Privacy policy versions table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type   text NOT NULL,  -- 'privacy_policy' | 'terms_of_service'
  version       text NOT NULL,
  effective_at  timestamptz NOT NULL DEFAULT now(),
  requires_reconsent boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(policy_type, version)
);

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_versions_public_read" ON policy_versions;
CREATE POLICY "policy_versions_public_read" ON policy_versions
  FOR SELECT USING (true);

-- Seed current versions
INSERT INTO policy_versions (policy_type, version, effective_at, requires_reconsent)
VALUES
  ('privacy_policy',   'v1.0', now(), false),
  ('terms_of_service', 'v1.0', now(), false)
ON CONFLICT (policy_type, version) DO NOTHING;
