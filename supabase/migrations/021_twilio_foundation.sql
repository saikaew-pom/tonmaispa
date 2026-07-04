-- ============================================================
-- TON MAI SPA — Twilio WhatsApp foundation
-- Server-only audit and message tables for signed webhooks,
-- duplicate protection and delivery/read status tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS twilio_webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key         text UNIQUE NOT NULL,
  event_type        text NOT NULL CHECK (event_type IN ('whatsapp_inbound', 'message_status')),
  twilio_sid        text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received'
                    CHECK (processing_status IN ('received', 'stored', 'failed')),
  processing_error  text,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_twilio_webhook_events_sid
  ON twilio_webhook_events(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_webhook_events_received
  ON twilio_webhook_events(received_at DESC);

CREATE TABLE IF NOT EXISTS twilio_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_message_sid  text UNIQUE NOT NULL,
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address        text,
  to_address          text,
  body                text,
  content_sid         text,
  media               jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'queued',
  error_code          text,
  error_message       text,
  raw_payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  read_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_twilio_messages_created
  ON twilio_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_twilio_messages_status
  ON twilio_messages(status);
CREATE INDEX IF NOT EXISTS idx_twilio_messages_from
  ON twilio_messages(from_address);

ALTER TABLE twilio_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_messages ENABLE ROW LEVEL SECURITY;

-- No public policies are created. These tables are intentionally accessible
-- only through trusted server routes using the Supabase service-role key.
