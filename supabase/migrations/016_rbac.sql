-- =============================================================================
-- 016_rbac.sql
-- Role-Based Access Control: user_roles, invitations, assigned_to on jobs
-- Updated RLS policies for team members
-- =============================================================================

-- ── user_roles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('owner', 'admin', 'technician', 'viewer')),
  status      text        NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'suspended', 'removed')),
  granted_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id     ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_business_id ON user_roles(business_id, status);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ── Helper: current user's role in a given business ───────────────────────────
-- Returns 'owner' | 'admin' | 'technician' | 'viewer' | NULL
-- Must be created AFTER user_roles table exists.
CREATE OR REPLACE FUNCTION my_role_in_business(bid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT role FROM user_roles
      WHERE user_id = auth.uid() AND business_id = bid AND status = 'active'
      LIMIT 1
    ),
    CASE
      WHEN EXISTS (SELECT 1 FROM businesses WHERE id = bid AND owner_id = auth.uid())
      THEN 'owner'
      ELSE NULL
    END
  );
$$;

-- Owner and admin can read all roles for their business
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (
    my_role_in_business(business_id) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

-- Only owner/admin can manage roles
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT WITH CHECK (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles
  FOR UPDATE USING (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE USING (my_role_in_business(business_id) IN ('owner', 'admin'));

-- ── invitations ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL CHECK (role IN ('admin', 'technician', 'viewer')),
  invited_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_business_id ON invitations(business_id, status);
CREATE INDEX IF NOT EXISTS invitations_token_hash  ON invitations(token_hash);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (my_role_in_business(business_id) IN ('owner', 'admin'));

-- ── jobs: add assigned_to ─────────────────────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_assigned_to ON jobs(assigned_to) WHERE assigned_to IS NOT NULL;

-- ── businesses: allow team members to SELECT their business ───────────────────

DROP POLICY IF EXISTS "businesses_select" ON businesses;
CREATE POLICY "businesses_select" ON businesses
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT business_id FROM user_roles
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT / UPDATE / DELETE remain owner-only (unchanged from migration 001)

-- ── customers: RBAC policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (
    my_role_in_business(business_id) IN ('owner', 'admin', 'technician', 'viewer')
  );

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (
    my_role_in_business(business_id) IN ('owner', 'admin', 'technician')
  );

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (
    my_role_in_business(business_id) IN ('owner', 'admin', 'technician')
  );

DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (
    my_role_in_business(business_id) IN ('owner', 'admin')
  );

-- ── jobs: RBAC policies (technician = own jobs only) ─────────────────────────

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (
    my_role_in_business(business_id) IN ('owner', 'admin', 'viewer')
    OR (
      my_role_in_business(business_id) = 'technician'
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
  );

DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT WITH CHECK (
    my_role_in_business(business_id) IN ('owner', 'admin')
    OR (
      my_role_in_business(business_id) = 'technician'
      AND assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE USING (
    my_role_in_business(business_id) IN ('owner', 'admin')
    OR (
      my_role_in_business(business_id) = 'technician'
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
  );

DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE USING (
    my_role_in_business(business_id) IN ('owner', 'admin')
  );

-- ── invoices: owner and admin only ───────────────────────────────────────────

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (my_role_in_business(business_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (my_role_in_business(business_id) IN ('owner', 'admin'));

-- ── Seed: create owner user_role for all existing business owners ─────────────
INSERT INTO user_roles (user_id, business_id, role, granted_by)
SELECT owner_id, id, 'owner', owner_id
FROM businesses
ON CONFLICT (user_id, business_id) DO NOTHING;
