-- ─────────────────────────────────────────────────────────────────────────────
-- 006_invoice_status.sql — Enhanced invoice status pipeline
-- ─────────────────────────────────────────────────────────────────────────────

-- ── New columns on invoices ───────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS status_history       jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS viewed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_count         integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at              timestamptz,
  ADD COLUMN IF NOT EXISTS sent_via             text,
  ADD COLUMN IF NOT EXISTS reminder_count       integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at     timestamptz,
  ADD COLUMN IF NOT EXISTS partial_paid_amount  decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method       text,
  ADD COLUMN IF NOT EXISTS payment_reference    text,
  ADD COLUMN IF NOT EXISTS disputed             boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_reason       text,
  ADD COLUMN IF NOT EXISTS recurring            boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_interval   text,
  ADD COLUMN IF NOT EXISTS recurring_next_date  date,
  ADD COLUMN IF NOT EXISTS deposit_required     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount       decimal(10,2),
  ADD COLUMN IF NOT EXISTS deposit_paid         boolean      NOT NULL DEFAULT false;

-- ── Update status constraint ──────────────────────────────────────────────────
-- Drop old constraint (name from 001_initial_schema.sql)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_check'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_status_check;
  END IF;
END $$;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'draft','pending_approval','sent','viewed','partial',
    'paid','overdue','disputed','cancelled','refunded','write_off'
  ));

-- ── sent_via constraint ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_sent_via_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_sent_via_check
      CHECK (sent_via IN ('email','sms','link','quickbooks') OR sent_via IS NULL);
  END IF;
END $$;

-- ── payment_method constraint ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_method_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check
      CHECK (payment_method IN ('stripe','quickbooks','cash','check','other') OR payment_method IS NULL);
  END IF;
END $$;
