-- =============================================================================
-- CrewBooks — Migration 002: Reminder Settings + Invoice FK on Reminders
-- =============================================================================

-- Add reminder_settings to businesses (default: all on)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS reminder_settings JSONB NOT NULL DEFAULT '{
    "appointment_reminder": {"enabled": true, "hours_before": 24, "template": "Hi {{customer_name}}, this is a reminder from {{business_name}} that your {{job_title}} appointment is tomorrow at {{time}}. Reply STOP to opt out."},
    "follow_up":            {"enabled": true, "days_after": 3,  "template": "Hi {{customer_name}}, {{business_name}} here. We hope you''re happy with your {{job_title}}! If you have a moment, we''d love a Google review: {{review_link}}. Thank you!"},
    "payment_reminder":     {"enabled": true, "days_after": 7,  "template": "Hi {{customer_name}}, friendly reminder that invoice {{invoice_number}} for {{total}} from {{business_name}} is due. Pay online: {{payment_link}}"}
  }';

-- Add invoice_id FK to reminders (for payment reminders)
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;

-- Extend the type check constraint to include manual_sms
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_type_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_type_check
  CHECK (type IN (
    'appointment_reminder',
    'follow_up',
    'review_request',
    'payment_reminder',
    'manual_sms'
  ));
