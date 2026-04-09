-- ─────────────────────────────────────────────────────────────────────────────
-- 004_quickbooks.sql — QuickBooks Online integration
-- ─────────────────────────────────────────────────────────────────────────────

-- ── businesses: QBO connection fields ────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS qbo_realm_id         text,
  ADD COLUMN IF NOT EXISTS qbo_access_token     text,
  ADD COLUMN IF NOT EXISTS qbo_refresh_token    text,
  ADD COLUMN IF NOT EXISTS qbo_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbo_connected_at     timestamptz,
  ADD COLUMN IF NOT EXISTS qbo_sync_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qbo_last_sync_at     timestamptz;

-- ── customers: QBO mapping ───────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS qbo_customer_id text,
  ADD COLUMN IF NOT EXISTS qbo_synced_at   timestamptz;

-- ── invoices: QBO mapping ────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qbo_invoice_id  text,
  ADD COLUMN IF NOT EXISTS qbo_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS qbo_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS qbo_sync_error  text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_qbo_sync_status_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_qbo_sync_status_check
      CHECK (qbo_sync_status IN ('not_synced', 'synced', 'error', 'pending'));
  END IF;
END $$;

-- ── sync_log table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL CHECK (entity_type IN ('customer', 'invoice', 'payment')),
  entity_id     uuid,
  direction     text        NOT NULL CHECK (direction IN ('push', 'pull')),
  status        text        NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  qbo_id        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own sync logs" ON sync_log;
CREATE POLICY "Users see their own sync logs" ON sync_log
  FOR ALL USING (
    business_id = (
      SELECT id FROM businesses WHERE user_id = auth.uid() LIMIT 1
    )
  );
