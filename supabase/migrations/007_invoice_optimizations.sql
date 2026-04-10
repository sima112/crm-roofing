-- ─────────────────────────────────────────────────────────────────────────────
-- 007_invoice_optimizations.sql — Deposits, recurring, late fees
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Additional invoice columns ────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deposit_payment_link text,
  ADD COLUMN IF NOT EXISTS recurring_end_date   date,
  ADD COLUMN IF NOT EXISTS recurring_parent_id  uuid REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS late_fee_amount       decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_applied_at   timestamptz;

-- ── Late fee settings on businesses ──────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS late_fee_settings jsonb;
-- Default structure:
-- { "enabled": false, "type": "flat", "amount": 25,
--   "grace_period_days": 7, "max_late_fee": 0 }

-- ── Expand payment_method constraint ─────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (payment_method IN (
    'stripe','quickbooks','cash','check','card',
    'bank_transfer','venmo','zelle','other'
  ) OR payment_method IS NULL);

-- ── Index for recurring invoices cron ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS invoices_recurring_idx
  ON invoices (recurring, recurring_next_date, status)
  WHERE recurring = true;
