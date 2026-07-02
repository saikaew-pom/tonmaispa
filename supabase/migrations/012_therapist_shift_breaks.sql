-- ============================================================
-- TON MAI SPA — Therapist Shift Breaks
-- Lets a shift have an optional break window (e.g. lunch 12:00-13:00)
-- during which the therapist is not bookable, without needing a
-- separate shift row (therapist_shifts has one row per therapist/date).
-- ============================================================

ALTER TABLE therapist_shifts ADD COLUMN break_start time;
ALTER TABLE therapist_shifts ADD COLUMN break_end   time;
