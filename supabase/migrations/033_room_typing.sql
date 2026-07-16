-- ============================================================
-- TON MAI SPA — Room typing
-- Run this manually in the Supabase SQL Editor.
--
-- The spa has 5 rooms, but they are not interchangeable (owner-confirmed
-- 2026-07-13):  1 couple's room  +  1 wet room (shower)  +  3 standard.
-- room_capacity only ever knew "5", so two guests could both book a body
-- scrub at 14:00 — 2 therapists free, 3 rooms free, system says yes — and
-- then fight over the ONE shower. Same for two Couple's Bliss bookings and
-- the one couple's room.
--
-- Foot Reflexology is done in reclining CHAIRS, not a treatment room, so it
-- must stop consuming room capacity entirely. Today it does, which means the
-- spa is losing bookable capacity. Thermal passes are 0-min and already
-- consume no time.
--
-- MODEL — requirement, not partition:
--   A treatment declares the room type it REQUIRES; most require nothing.
--   Rooms are NOT hard-partitioned: a plain massage may use the couple's room
--   when it is free. Only the SCARCE specialised types get their own check;
--   'any' stays bounded by the existing total-rooms check. This keeps the
--   capacity we have while preventing the conflicts that are real.
--
--   Accepted residual risk: a plain massage physically occupying the wet room
--   is not tracked. With 3 therapists and 5 rooms there are always ≥2 spare
--   rooms, so staff can place guests sensibly. Revisit if therapists grow.
--
-- This migration changes behaviour on its own (unlike 032): reflexology stops
-- holding a room, and a second wet/couples booking in the same window is
-- refused.
-- ============================================================

-- 1) What a treatment needs. 'any' = any free room. 'none' = no room at all.
ALTER TABLE spa_treatments
  ADD COLUMN IF NOT EXISTS room_requirement text NOT NULL DEFAULT 'any';

DO $$ BEGIN
  ALTER TABLE spa_treatments ADD CONSTRAINT spa_treatments_room_requirement_check
    CHECK (room_requirement IN ('any', 'wet', 'couples', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Snapshot on the booking so capacity math (and the trigger) never needs a
-- join, and history survives a treatment being deleted (treatment_id is
-- ON DELETE SET NULL). Kept authoritative by the trigger below — no write
-- path has to remember to set it.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_requirement text NOT NULL DEFAULT 'any';

-- 2) How many of each SPECIALISED room exist. 'standard' deliberately has no
-- row: a standard treatment can use any free room, so it is already bounded
-- by room_capacity's total. Staff-editable, no deploy needed.
CREATE TABLE IF NOT EXISTS room_type_capacity (
  room_type  text PRIMARY KEY CHECK (room_type IN ('wet', 'couples')),
  room_count int NOT NULL CHECK (room_count >= 0),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO room_type_capacity (room_type, room_count)
VALUES ('wet', 1), ('couples', 1)
ON CONFLICT (room_type) DO NOTHING;

ALTER TABLE room_type_capacity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON room_type_capacity;
CREATE POLICY "Service role full access" ON room_type_capacity
  FOR ALL USING (auth.role() = 'service_role');

-- 3) Classify the live menu (owner-confirmed). Matched by slug — stable, and
-- avoids apostrophe escaping on "Couple's Bliss Package".
UPDATE spa_treatments SET room_requirement = 'couples'
  WHERE slug = 'couples-bliss-package';

UPDATE spa_treatments SET room_requirement = 'wet'
  WHERE slug IN ('lemongrass-body-scrub', 'coconut-coffee-scrub', 'rawai-renewal-package');

-- Reflexology = reclining chairs. Thermal passes = facility access, 0 min.
UPDATE spa_treatments SET room_requirement = 'none'
  WHERE slug = 'foot-reflexology' OR category = 'thermotherapy';

-- 4) Backfill existing bookings from their treatment.
UPDATE bookings b
   SET room_requirement = COALESCE(t.room_requirement, 'any')
  FROM spa_treatments t
 WHERE t.id = b.treatment_id
   AND b.room_requirement IS DISTINCT FROM COALESCE(t.room_requirement, 'any');

CREATE INDEX IF NOT EXISTS idx_bookings_room_requirement
  ON bookings (date, room_requirement)
  WHERE room_requirement <> 'none';

-- 5) Capacity trigger: now also the owner of room_requirement, and enforces
-- specialised-room scarcity. Supersedes 032's version.
CREATE OR REPLACE FUNCTION enforce_booking_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_new_start timestamp;
  v_new_end   timestamp;
  v_room_count int;
  v_type_count int;
  v_overlapping int;
  v_conflicts int;
  v_req text;
BEGIN
  -- Resolve the room requirement from the treatment FIRST, before any early
  -- return, so the stored snapshot is always right even for cancelled or
  -- deliberately-overbooked rows. Doing it here (not in each write path)
  -- means no route can forget it and quietly under-reserve a scarce room.
  IF NEW.treatment_id IS NOT NULL THEN
    SELECT COALESCE(t.room_requirement, 'any') INTO v_req
      FROM spa_treatments t WHERE t.id = NEW.treatment_id;
    NEW.room_requirement := COALESCE(v_req, 'any');
  END IF;
  IF NEW.room_requirement IS NULL THEN NEW.room_requirement := 'any'; END IF;

  -- Deliberate staff overbook: skip all capacity enforcement.
  IF NEW.overbooked THEN RETURN NEW; END IF;

  -- Only active bookings occupy capacity.
  IF NEW.status NOT IN ('pending', 'confirmed') THEN RETURN NEW; END IF;

  -- On UPDATE, only re-check when a capacity-relevant field actually changes
  -- or the booking is being (re)activated.
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending', 'confirmed')
     AND OLD.date = NEW.date
     AND OLD.time_slot = NEW.time_slot
     AND OLD.duration = NEW.duration
     AND COALESCE(OLD.addon_minutes, 0) = COALESCE(NEW.addon_minutes, 0)
     AND COALESCE(OLD.room_requirement, 'any') = COALESCE(NEW.room_requirement, 'any')
     AND OLD.therapist_id IS NOT DISTINCT FROM NEW.therapist_id
     AND OLD.secondary_therapist_id IS NOT DISTINCT FROM NEW.secondary_therapist_id
  THEN
    RETURN NEW;
  END IF;

  -- Serialize all capacity-relevant booking writes for this date.
  PERFORM pg_advisory_xact_lock(hashtext('bookings_capacity_' || NEW.date::text));

  v_new_start := NEW.date + NEW.time_slot;
  v_new_end   := v_new_start
                 + make_interval(mins => NEW.duration + COALESCE(NEW.addon_minutes, 0));

  -- 1) Therapist double-booking (primary or secondary, both directions).
  -- Applies even to 'none' treatments: reflexology needs no room, but it very
  -- much needs a therapist.
  IF NEW.therapist_id IS NOT NULL OR NEW.secondary_therapist_id IS NOT NULL THEN
    SELECT count(*) INTO v_conflicts
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed')
      AND (b.date + b.time_slot) < v_new_end
      AND v_new_start < (b.date + b.time_slot
            + make_interval(mins => b.duration + COALESCE(b.addon_minutes, 0)))
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

  -- Treatments needing no room (reflexology chairs, thermal passes) are done
  -- with room checks entirely.
  IF NEW.room_requirement = 'none' THEN
    RETURN NEW;
  END IF;

  -- 2) Total physical rooms for this weekday. Bookings that need no room are
  -- excluded from the count. Lenient if unconfigured.
  SELECT room_count INTO v_room_count
  FROM room_capacity WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::int;

  IF v_room_count IS NOT NULL THEN
    SELECT count(*) INTO v_overlapping
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed')
      AND b.room_requirement <> 'none'
      AND (b.date + b.time_slot) < v_new_end
      AND v_new_start < (b.date + b.time_slot
            + make_interval(mins => b.duration + COALESCE(b.addon_minutes, 0)));
    IF v_overlapping >= v_room_count THEN
      RAISE EXCEPTION 'ROOM_CAPACITY_FULL';
    END IF;
  END IF;

  -- 3) Specialised room scarcity: only bookings needing the SAME type compete.
  -- ('any' needs no check here — it is already bounded by the total above.)
  IF NEW.room_requirement IN ('wet', 'couples') THEN
    SELECT room_count INTO v_type_count
    FROM room_type_capacity WHERE room_type = NEW.room_requirement;

    IF v_type_count IS NOT NULL THEN
      SELECT count(*) INTO v_overlapping
      FROM bookings b
      WHERE b.date = NEW.date
        AND b.id IS DISTINCT FROM NEW.id
        AND b.status IN ('pending', 'confirmed')
        AND b.room_requirement = NEW.room_requirement
        AND (b.date + b.time_slot) < v_new_end
        AND v_new_start < (b.date + b.time_slot
              + make_interval(mins => b.duration + COALESCE(b.addon_minutes, 0)));
      IF v_overlapping >= v_type_count THEN
        RAISE EXCEPTION 'ROOM_TYPE_FULL_%', NEW.room_requirement;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS booking_capacity_trigger ON bookings;
CREATE TRIGGER booking_capacity_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_capacity();
