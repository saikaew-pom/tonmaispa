-- ============================================================
-- TON MAI SPA — WhatsApp thank-you / survey follow-up tracking
-- Run this manually in the Supabase SQL Editor before using the
-- follow-up button or scheduled follow-up cron.
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_followup_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_followup_status text;
