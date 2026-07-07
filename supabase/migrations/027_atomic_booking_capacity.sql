-- ============================================================
-- TON MAI SPA — Atomic booking capacity enforcement
-- Run this manually in the Supabase SQL Editor.
--
-- Closes the check-then-insert race: two requests grabbing the last
-- free slot at the same instant could both pass the JS capacity check
-- and double-book a therapist (reproduced by scripts/test-booking-engine.mjs).
-- A BEFORE trigger now serializes capacity-relevant booking writes per
-- date with a transaction-scoped advisory lock, then re-checks therapist
-- overlap (primary AND secondary, both directions) and physical room
-- capacity inside the same transaction — making the check atomic.
--
-- Staff can still overbook deliberately: the dashboard's explicit
-- "book anyway" path sets the new `overbooked` flag, which bypasses
-- the trigger (and is auditable on the row).
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS overbooked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION enforce_booking_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_new_start timestamp;
  v_new_end   timestamp;
  v_room_count int;
  v_overlapping int;
  v_conflicts int;
BEGIN
  -- Deliberate staff overbook: skip all capacity enforcement.
  IF NEW.overbooked THEN RETURN NEW; END IF;

  -- Only active bookings occupy capacity.
  IF NEW.status NOT IN ('pending', 'confirmed') THEN RETURN NEW; END IF;

  -- On UPDATE, only re-check when a capacity-relevant field actually
  -- changes or the booking is being (re)activated — notes edits, email
  -- timestamps, etc. must not pay the serialization cost.
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending', 'confirmed')
     AND OLD.date = NEW.date
     AND OLD.time_slot = NEW.time_slot
     AND OLD.duration = NEW.duration
     AND OLD.therapist_id IS NOT DISTINCT FROM NEW.therapist_id
     AND OLD.secondary_therapist_id IS NOT DISTINCT FROM NEW.secondary_therapist_id
  THEN
    RETURN NEW;
  END IF;

  -- Serialize all capacity-relevant booking writes for this date.
  PERFORM pg_advisory_xact_lock(hashtext('bookings_capacity_' || NEW.date::text));

  v_new_start := NEW.date + NEW.time_slot;
  v_new_end   := v_new_start + make_interval(mins => NEW.duration);

  -- 1) Therapist double-booking (primary or secondary, both directions).
  IF NEW.therapist_id IS NOT NULL OR NEW.secondary_therapist_id IS NOT NULL THEN
    SELECT count(*) INTO v_conflicts
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed')
      AND (b.date + b.time_slot) < v_new_end
      AND v_new_start < (b.date + b.time_slot + make_interval(mins => b.duration))
      AND (
        (NEW.therapist_id IS NOT NULL
          AND (b.therapist_id = NEW.therapist_id OR b.secondary_therapist_id = NEW.therapist_id))
        OR
        (NEW.secondary_therapist_id IS NOT NULL
          AND (b.therapist_id = NEW.secondary_therapist_id OR b.secondary_therapist_id = NEW.secondary_therapist_id))
      );
    IF v_conflicts > 0 THEN
      RAISE EXCEPTION 'THERAPIST_DOUBLE_BOOKED';
    END IF;
  END IF;

  -- 2) Physical room capacity for this weekday. Lenient if unconfigured
  -- (no row) — the application layer already blocks in that case.
  SELECT room_count INTO v_room_count
  FROM room_capacity WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::int;

  IF v_room_count IS NOT NULL THEN
    SELECT count(*) INTO v_overlapping
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed')
      AND (b.date + b.time_slot) < v_new_end
      AND v_new_start < (b.date + b.time_slot + make_interval(mins => b.duration));
    IF v_overlapping >= v_room_count THEN
      RAISE EXCEPTION 'ROOM_CAPACITY_FULL';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS booking_capacity_trigger ON bookings;
CREATE TRIGGER booking_capacity_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_capacity();
