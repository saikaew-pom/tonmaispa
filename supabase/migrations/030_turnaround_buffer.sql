-- ============================================================
-- TON MAI SPA — Turnaround / buffer time between sessions
-- Run this manually in the Supabase SQL Editor.
--
-- Adds a spa-wide "turnaround" buffer (minutes) that a therapist AND a
-- treatment room need between two guests for cleanup, reset and rest.
-- Availability + capacity now keep any two of a therapist's (or a room's)
-- sessions at least this many minutes apart, instead of allowing perfectly
-- back-to-back bookings.
--
-- Stored on the GLOBAL slot rule (treatment_id IS NULL) as a single
-- spa-wide policy. DEFAULT 0 preserves today's exact behaviour — nothing
-- changes on the live site until staff set a value. The application reads
-- it live (no deploy needed) and is safe whether or not this migration has
-- run yet (a missing column reads as 0).
--
-- To turn it on later, e.g. a 15-minute gap:
--   UPDATE slot_settings SET turnaround_min = 15
--   WHERE treatment_id IS NULL AND is_active = true;
-- Set back to 0 to disable. Higher values reduce how many bookings fit in a
-- day, so tune to real cleanup/rest needs.
-- ============================================================

ALTER TABLE slot_settings
  ADD COLUMN IF NOT EXISTS turnaround_min int NOT NULL DEFAULT 0;
