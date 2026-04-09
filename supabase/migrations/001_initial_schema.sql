-- =============================================================================
-- CrewBooks — Initial Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- Helper: auto-generate invoice_number per business ("INV-0001")
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq integer;
BEGIN
  SELECT COUNT(*) + 1
    INTO next_seq
    FROM invoices
   WHERE business_id = NEW.business_id;

  NEW.invoice_number := 'INV-' || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLE: businesses
-- =============================================================================
CREATE TABLE IF NOT EXISTS businesses (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  trade               text        NOT NULL DEFAULT 'roofing'
                                  CHECK (trade IN ('roofing','hvac','plumbing','electrical','landscaping','general')),
  phone               text,
  email               text,
  address             text,
  logo_url            text,
  stripe_customer_id  text,
  subscription_status text        NOT NULL DEFAULT 'trial'
                                  CHECK (subscription_status IN ('trial','active','past_due','cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS businesses_owner_id_idx ON businesses (owner_id);

CREATE OR REPLACE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_select" ON businesses;
CREATE POLICY "businesses_select" ON businesses
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_insert" ON businesses;
CREATE POLICY "businesses_insert" ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_update" ON businesses;
CREATE POLICY "businesses_update" ON businesses
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_delete" ON businesses;
CREATE POLICY "businesses_delete" ON businesses
  FOR DELETE USING (owner_id = auth.uid());


-- =============================================================================
-- TABLE: customers
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  phone       text,
  email       text,
  address     text,
  city        text,
  state       text        DEFAULT 'TX',
  zip         text,
  notes       text,
  tags        text[],
  source      text        CHECK (source IN ('referral','google','facebook','door-knock','other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_business_id_name_idx ON customers (business_id, name);

CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =============================================================================
-- TABLE: jobs
-- =============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id      uuid         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title            text         NOT NULL,
  description      text,
  status           text         NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  priority         text         NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('low','normal','high','urgent')),
  scheduled_date   date,
  scheduled_time   time,
  completed_date   timestamptz,
  estimated_amount decimal(10,2),
  actual_amount    decimal(10,2),
  notes            text,
  before_photos    text[],
  after_photos     text[],
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_business_id_status_date_idx ON jobs (business_id, status, scheduled_date);

CREATE OR REPLACE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =============================================================================
-- TABLE: invoices
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id               uuid         REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id          uuid         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number       text         NOT NULL,
  amount               decimal(10,2) NOT NULL,
  tax_rate             decimal(5,4) NOT NULL DEFAULT 0.0825,
  tax_amount           decimal(10,2) GENERATED ALWAYS AS (amount * tax_rate) STORED,
  total                decimal(10,2) GENERATED ALWAYS AS (amount + amount * tax_rate) STORED,
  status               text         NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  stripe_invoice_id    text,
  stripe_payment_link  text,
  due_date             date,
  paid_date            timestamptz,
  notes                text,
  line_items           jsonb        NOT NULL DEFAULT '[]',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_business_id_status_idx ON invoices (business_id, status);

-- Auto-generate invoice_number before insert (only when not explicitly provided)
CREATE OR REPLACE TRIGGER invoices_set_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

CREATE OR REPLACE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =============================================================================
-- TABLE: reminders
-- =============================================================================
CREATE TABLE IF NOT EXISTS reminders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id        uuid        REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type          text        NOT NULL
                            CHECK (type IN ('appointment_reminder','follow_up','review_request','payment_reminder')),
  message       text        NOT NULL,
  phone         text        NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at       timestamptz,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_business_id_status_scheduled_idx
  ON reminders (business_id, status, scheduled_for);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select" ON reminders;
CREATE POLICY "reminders_select" ON reminders
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_insert" ON reminders
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "reminders_update" ON reminders;
CREATE POLICY "reminders_update" ON reminders
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_delete" ON reminders
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =============================================================================
-- STORAGE: job-photos bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload into their own business folder
DROP POLICY IF EXISTS "job_photos_insert" ON storage.objects;
CREATE POLICY "job_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Allow authenticated users to read their own business's photos
DROP POLICY IF EXISTS "job_photos_select" ON storage.objects;
CREATE POLICY "job_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Allow authenticated users to delete their own business's photos
DROP POLICY IF EXISTS "job_photos_delete" ON storage.objects;
CREATE POLICY "job_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE owner_id = auth.uid()
    )
  );
