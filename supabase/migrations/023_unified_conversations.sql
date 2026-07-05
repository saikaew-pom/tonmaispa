-- ============================================================
-- TON MAI SPA — unified web + WhatsApp conversation timeline
-- One message per row, server-only, with a small durable reply job so a
-- Twilio webhook can be acknowledged before the chatbot finishes replying.
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_threads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid REFERENCES customers(id) ON DELETE SET NULL,
  channel               text NOT NULL DEFAULT 'web'
                        CHECK (channel IN ('web', 'whatsapp', 'mixed')),
  mode                  text NOT NULL DEFAULT 'bot'
                        CHECK (mode IN ('bot', 'waiting_for_staff', 'human', 'closed')),
  web_session_id        text UNIQUE,
  whatsapp_address      text UNIQUE,
  assigned_staff_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  last_active_at        timestamptz NOT NULL DEFAULT now(),
  last_inbound_at       timestamptz,
  last_outbound_at      timestamptz,
  closed_at             timestamptz,
  CHECK (web_session_id IS NOT NULL OR whatsapp_address IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_customer
  ON conversation_threads(customer_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_queue
  ON conversation_threads(mode, last_active_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  sender_type           text NOT NULL
                        CHECK (sender_type IN ('customer', 'bot', 'staff', 'system')),
  channel               text NOT NULL CHECK (channel IN ('web', 'whatsapp')),
  body                  text,
  twilio_message_sid    text UNIQUE,
  dedupe_key            text UNIQUE NOT NULL,
  delivery_status       text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  delivered_at          timestamptz,
  read_at               timestamptz,
  CHECK (body IS NOT NULL OR metadata <> '{}'::jsonb)
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_timeline
  ON conversation_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_twilio
  ON conversation_messages(twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_reply_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  inbound_message_sid   text UNIQUE NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts              integer NOT NULL DEFAULT 0,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  completed_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conversation_reply_jobs_pending
  ON conversation_reply_jobs(status, created_at ASC);

ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reply_jobs ENABLE ROW LEVEL SECURITY;

-- No public policies: conversation history is private and is available only
-- through authenticated server routes using the service-role client.

-- Preserve existing website chat history while moving to row-per-message
-- storage. The old JSON column remains in place for a safe transition.
INSERT INTO conversation_threads (
  customer_id, channel, web_session_id, created_at, updated_at, last_active_at
)
SELECT customer_id, 'web', session_id, created_at, last_active, last_active
FROM chat_sessions
ON CONFLICT (web_session_id) DO NOTHING;

INSERT INTO conversation_messages (
  thread_id, sender_type, channel, body, dedupe_key, metadata, created_at
)
SELECT
  ct.id,
  CASE WHEN item.message->>'role' = 'user' THEN 'customer' ELSE 'bot' END,
  'web',
  item.message->>'content',
  'web:' || cs.session_id::text || ':migration:' || item.position::text,
  jsonb_build_object('migrated_from_chat_sessions', true),
  COALESCE(NULLIF(item.message->>'timestamp', '')::timestamptz, cs.created_at)
FROM chat_sessions cs
JOIN conversation_threads ct ON ct.web_session_id = cs.session_id
CROSS JOIN LATERAL jsonb_array_elements(cs.messages) WITH ORDINALITY AS item(message, position)
WHERE item.message->>'role' IN ('user', 'assistant')
  AND NULLIF(item.message->>'content', '') IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

-- Bring the already-tested Sandbox messages into the new timeline. The
-- participant is the sender for inbound messages and the recipient for
-- outbound messages. Re-running this migration is duplicate-safe.
INSERT INTO conversation_threads (customer_id, channel, whatsapp_address)
SELECT DISTINCT c.id, 'whatsapp', p.whatsapp_address
FROM (
  SELECT CASE WHEN direction = 'inbound' THEN from_address ELSE to_address END AS whatsapp_address
  FROM twilio_messages
) p
LEFT JOIN customers c
  ON c.primary_phone_e164 = replace(p.whatsapp_address, 'whatsapp:', '')
WHERE p.whatsapp_address LIKE 'whatsapp:+%'
ON CONFLICT (whatsapp_address) DO NOTHING;

INSERT INTO conversation_messages (
  thread_id, sender_type, channel, body, twilio_message_sid,
  dedupe_key, delivery_status, metadata, created_at, delivered_at, read_at
)
SELECT
  ct.id,
  CASE WHEN tm.direction = 'inbound' THEN 'customer' ELSE 'bot' END,
  'whatsapp',
  tm.body,
  tm.twilio_message_sid,
  'twilio:' || tm.twilio_message_sid,
  tm.status,
  jsonb_build_object('migrated_from_twilio_messages', true, 'media', tm.media),
  tm.created_at,
  tm.delivered_at,
  tm.read_at
FROM twilio_messages tm
JOIN conversation_threads ct ON ct.whatsapp_address =
  CASE WHEN tm.direction = 'inbound' THEN tm.from_address ELSE tm.to_address END
ON CONFLICT (dedupe_key) DO NOTHING;

UPDATE conversation_threads ct SET
  last_active_at = summary.last_active_at,
  last_inbound_at = summary.last_inbound_at,
  last_outbound_at = summary.last_outbound_at,
  updated_at = summary.last_active_at
FROM (
  SELECT
    thread_id,
    max(created_at) AS last_active_at,
    max(created_at) FILTER (WHERE sender_type = 'customer') AS last_inbound_at,
    max(created_at) FILTER (WHERE sender_type IN ('bot', 'staff')) AS last_outbound_at
  FROM conversation_messages
  GROUP BY thread_id
) summary
WHERE ct.id = summary.thread_id;

-- This is an optional paid feature. It is enabled for the Ton Mai pilot but
-- can be switched off immediately from Super Admin → Settings.
INSERT INTO site_content (key, value_text, page)
VALUES ('settings.whatsapp_chatbot_enabled', 'true', 'settings')
ON CONFLICT (key) DO NOTHING;
