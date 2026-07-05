-- ============================================================
-- TON MAI SPA — Track which status a WhatsApp update reflected
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- Mirrors last_email_status (added in 025): lets the dashboard tell whether
-- the last WhatsApp update actually matches the booking's CURRENT status,
-- so "Send via WhatsApp" reappears if status changes again after a send —
-- instead of hiding forever after the first send regardless of new changes.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_whatsapp_status text;
