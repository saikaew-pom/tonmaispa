-- ============================================================
-- TON MAI SPA — Guest profiles (CRM foundation)
-- One row per real guest, identified by phone number (the one field
-- consistently collected across all three booking paths: public site,
-- admin dashboard, chatbot). bookings.guest_id links each booking back to
-- its guest so booking history / lifetime value can be computed per guest.
-- ============================================================

CREATE TABLE guests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text NOT NULL,
  phone       text NOT NULL UNIQUE,
  email       text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_guests_phone ON guests(phone);

ALTER TABLE bookings ADD COLUMN guest_id uuid REFERENCES guests(id);

-- Backfill: one guest per distinct phone already seen in bookings, using
-- the most recent name/email on file for that phone.
INSERT INTO guests (full_name, phone, email)
SELECT DISTINCT ON (guest_phone) guest_name, guest_phone, guest_email
FROM bookings
WHERE guest_phone IS NOT NULL AND guest_phone <> ''
ORDER BY guest_phone, created_at DESC
ON CONFLICT (phone) DO NOTHING;

UPDATE bookings b SET guest_id = g.id
FROM guests g
WHERE b.guest_phone = g.phone AND b.guest_id IS NULL;

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON guests
  FOR ALL USING (auth.role() = 'service_role');
