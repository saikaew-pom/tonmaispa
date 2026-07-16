-- ============================================================
-- TON MAI SPA — Add-on occupancy
-- Run this manually in the Supabase SQL Editor.
--
-- Until now an add-on (Scalp Oil 15min, Extended Foot Soak 15min, Eye Mask
-- 0min) was only ever a line of free text in bookings.notes: it reserved NO
-- therapist or room time and contributed NO revenue. A 60-min massage plus a
-- 15-min scalp oil occupied 60 minutes on paper and 75 in real life, so the
-- next guest could be booked into a room that was still busy.
--
-- WHY A SEPARATE COLUMN, not just a bigger bookings.duration:
--   bookings.duration is the BILLED duration — it is validated against
--   spa_treatments.duration_options and used as the key into
--   spa_treatments.prices. Storing 75 there would be rejected outright by the
--   public/WhatsApp/chat write paths ("that duration is not offered"), would
--   make prices['75'] undefined and silently store price = NULL (poisoning the
--   revenue insights), and the dashboard edit UI would quietly snap it back to
--   60 on the next staff edit — releasing time the guest still expects.
-- So: duration stays BILLED, addon_minutes carries the extra OCCUPANCY, and
-- occupancy = duration + addon_minutes everywhere capacity is computed.
--
-- This migration is a behavioural no-op on its own: addon_minutes defaults to
-- 0, so every existing booking keeps exactly its current footprint.
-- ============================================================

-- 1) Extra occupied minutes contributed by add-ons. Denormalised onto the row
-- (like price/duration already are) so the capacity hot path and the trigger
-- never need a join.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS addon_minutes int NOT NULL DEFAULT 0;

-- 2) The add-on line items themselves. Values are SNAPSHOTS taken at booking
-- time: a later price/duration change on the treatment must not rewrite what
-- the guest was quoted.
CREATE TABLE IF NOT EXISTS booking_addons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES spa_treatments(id) ON DELETE SET NULL,
  name         text NOT NULL,
  duration     int  NOT NULL DEFAULT 0,
  price        int,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_addons_booking ON booking_addons(booking_id);

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON booking_addons;
CREATE POLICY "Service role full access" ON booking_addons
  FOR ALL USING (auth.role() = 'service_role');

-- 3) Teach the capacity trigger that a booking occupies duration + addon_minutes.
-- Identical to 027 except every make_interval() now spans the full occupancy,
-- and the UPDATE short-circuit also watches addon_minutes.
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
  -- changes or the booking is being (re)activated.
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending', 'confirmed')
     AND OLD.date = NEW.date
     AND OLD.time_slot = NEW.time_slot
     AND OLD.duration = NEW.duration
     AND COALESCE(OLD.addon_minutes, 0) = COALESCE(NEW.addon_minutes, 0)
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

  -- 2) Physical room capacity for this weekday. Lenient if unconfigured.
  SELECT room_count INTO v_room_count
  FROM room_capacity WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::int;

  IF v_room_count IS NOT NULL THEN
    SELECT count(*) INTO v_overlapping
    FROM bookings b
    WHERE b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed')
      AND (b.date + b.time_slot) < v_new_end
      AND v_new_start < (b.date + b.time_slot
            + make_interval(mins => b.duration + COALESCE(b.addon_minutes, 0)));
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
