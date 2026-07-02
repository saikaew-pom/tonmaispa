-- ============================================================
-- TON MAI SPA — Multi-Therapist Treatments (e.g. Couple's Bliss)
-- Some treatments (couple's massages) genuinely require 2 therapists
-- working simultaneously, not just 1. Adds a per-treatment required
-- count and a second therapist slot on bookings so availability
-- checking and auto-assignment can enforce it correctly instead of
-- silently under-staffing the booking.
-- ============================================================

ALTER TABLE spa_treatments ADD COLUMN therapists_required int NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN secondary_therapist_id uuid REFERENCES therapists ON DELETE SET NULL;

UPDATE spa_treatments SET therapists_required = 2 WHERE id = '1c455df2-82ab-42fe-94ab-371f2f1783bc'; -- Couple's Bliss Package
