-- ─────────────────────────────────────────────────────────────────────────────
-- 008_ai_chat.sql — CrewBot AI conversation storage + rate limiting
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'New conversation',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_business_idx
  ON ai_conversations (business_id, updated_at DESC);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             text        NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content          text        NOT NULL DEFAULT '',
  tool_calls       jsonb,
  tool_results     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx
  ON ai_messages (conversation_id, created_at ASC);

-- ── Daily usage tracking ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date         date        NOT NULL DEFAULT CURRENT_DATE,
  message_count integer    NOT NULL DEFAULT 0,
  UNIQUE (business_id, date)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage         ENABLE ROW LEVEL SECURITY;

-- Conversations: owner via business
DROP POLICY IF EXISTS "ai_conversations_owner" ON ai_conversations;
CREATE POLICY "ai_conversations_owner" ON ai_conversations
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Messages: owner via conversation → business
DROP POLICY IF EXISTS "ai_messages_owner" ON ai_messages;
CREATE POLICY "ai_messages_owner" ON ai_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM ai_conversations
      WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Usage: owner via business
DROP POLICY IF EXISTS "ai_usage_owner" ON ai_usage;
CREATE POLICY "ai_usage_owner" ON ai_usage
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_ai_conversation_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ai_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_messages_update_conversation ON ai_messages;
CREATE TRIGGER ai_messages_update_conversation
  AFTER INSERT ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION update_ai_conversation_timestamp();
