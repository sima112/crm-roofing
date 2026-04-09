-- ─────────────────────────────────────────────────────────────────────────────
-- 005_quickbooks_settings.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS qbo_company_name  text,
  ADD COLUMN IF NOT EXISTS qbo_sync_settings jsonb NOT NULL DEFAULT '{
    "auto_sync_invoices": true,
    "auto_sync_customers": true,
    "pull_payments": true
  }'::jsonb;
