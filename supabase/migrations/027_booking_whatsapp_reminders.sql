-- ============================================================
-- TON MAI SPA — WhatsApp booking reminder tracking
-- Run this manually in the Supabase SQL Editor before deploying
-- reminder UI/API changes that read these fields.
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_reminder_status text;

