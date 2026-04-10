-- ─────────────────────────────────────────────────────────────────────────────
-- 012_audit.sql
-- Database audit log with triggers + RLS hardening
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Audit log table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS db_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   text NOT NULL,
  operation    text NOT NULL,  -- INSERT | UPDATE | DELETE
  record_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  changed_by   uuid,           -- auth.uid() at time of change (may be null for service-role ops)
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS db_audit_log_table_changed
  ON db_audit_log(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS db_audit_log_record
  ON db_audit_log(record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS db_audit_log_user
  ON db_audit_log(changed_by, changed_at DESC);

ALTER TABLE db_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service-role can insert; users can read their own entries
DROP POLICY IF EXISTS "audit_log_owner_read" ON db_audit_log;
CREATE POLICY "audit_log_owner_read" ON db_audit_log
  FOR SELECT USING (auth.uid() = changed_by);

-- ── Generic audit trigger function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO db_audit_log (table_name, operation, record_id, old_values, new_values, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Attach triggers to key tables ───────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'invoices', 'jobs', 'consent_records'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS audit_%1$s ON %1$s;
      CREATE TRIGGER audit_%1$s
        AFTER INSERT OR UPDATE OR DELETE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
    ', t);
  END LOOP;
END $$;

-- ── Purge audit logs older than 2 years (requires pg_cron extension) ────────
-- Uncomment after enabling pg_cron in Supabase dashboard:
-- SELECT cron.schedule('purge-audit-log', '0 3 * * *',
--   'DELETE FROM db_audit_log WHERE changed_at < now() - interval ''2 years''');

-- ── Ensure RLS is enabled on all business tables ────────────────────────────

ALTER TABLE IF EXISTS businesses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS consent_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS policy_versions  ENABLE ROW LEVEL SECURITY;
