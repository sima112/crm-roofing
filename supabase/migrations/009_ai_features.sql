-- ─────────────────────────────────────────────────────────────────────────────
-- 009_ai_features.sql — AI smart features: daily briefing, job summaries,
--                        smart suggestions, usage tracking, AI toggles
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Business AI settings ──────────────────────────────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_enabled               boolean     NOT NULL DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS daily_briefing_enabled   boolean     NOT NULL DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS daily_briefing_time      time        NOT NULL DEFAULT '07:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS daily_briefing_phone     text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS smart_suggestions_enabled boolean    NOT NULL DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_tokens_used_today     integer     NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_tokens_reset_at       timestamptz NOT NULL DEFAULT now();

-- ── Job AI-generated summary ──────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_summary              text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz;
