-- ============================================================
-- TON MAI SPA — Therapist Capability, Calendar Shifts & Room Capacity
-- Lets admins define which treatments each therapist can perform,
-- their exact working hours on specific calendar dates, and how many
-- treatment rooms exist per weekday — so booking availability
-- reflects real staffing/rooms instead of a flat concurrency cap.
-- ============================================================

-- Which treatments a therapist is qualified to perform
CREATE TABLE therapist_treatments (
  therapist_id uuid NOT NULL REFERENCES therapists ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES spa_treatments ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, treatment_id)
);

-- Exact calendar shift per therapist per date. No row for a date means
-- that therapist isn't working that day. Deliberately per-date (not a
-- recurring weekly template) — admin sets real hours for real dates.
CREATE TABLE therapist_shifts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists ON DELETE CASCADE,
  date         date NOT NULL,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  UNIQUE (therapist_id, date)
);
CREATE INDEX idx_therapist_shifts_date ON therapist_shifts(date);

-- Treatment rooms available per weekday (0=Sun..6=Sat), recurring.
CREATE TABLE room_capacity (
  day_of_week int PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  room_count  int NOT NULL DEFAULT 3
);
INSERT INTO room_capacity (day_of_week, room_count) VALUES (0,3),(1,3),(2,3),(3,3),(4,3),(5,3),(6,3);

ALTER TABLE therapist_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_shifts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_capacity        ENABLE ROW LEVEL SECURITY;

-- Service-role only — read/written exclusively by server-side admin
-- routes and the availability engine, never directly by browsers.
CREATE POLICY "Service role full access" ON therapist_treatments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON therapist_shifts     FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON room_capacity        FOR ALL USING (auth.role() = 'service_role');
