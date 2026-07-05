-- ============================================================
-- TON MAI SPA — Booking notification tracking + audit log
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- Persisted notification state so "Email sent" / "WhatsApp sent" survives a
-- page reload instead of living only in client-side React state.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_email_status  text; -- status the email reflected, e.g. 'confirmed'/'cancelled'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_whatsapp_sent_at timestamptz;

-- Audit trail: who changed what on a booking, and when. Powers the
-- "View logs" button in the dashboard bookings page.
CREATE TABLE IF NOT EXISTS booking_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  actor_email text,                -- null for system/automated actions (e.g. public booking creation)
  action      text NOT NULL,       -- 'created' | 'edited' | 'status_changed' | 'email_sent' | 'whatsapp_sent'
  detail      text,                -- human-readable summary, e.g. "status: pending -> confirmed"
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_logs_booking ON booking_logs(booking_id, created_at DESC);

ALTER TABLE booking_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON booking_logs
  FOR ALL USING (auth.role() = 'service_role');
