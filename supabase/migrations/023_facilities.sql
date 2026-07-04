-- ============================================================
-- TON MAI SPA — Facilities CMS: the homepage "Facilities" gallery
-- (steam room, sauna, cold plunge, pool, garden, restaurant, etc.) was
-- previously hardcoded in components/sections/FacilitiesSection.jsx and
-- the i18n dictionaries. This moves it to a DB-driven, dashboard-editable
-- table, following the same pattern as spa_treatments/gallery_photos.
-- ============================================================

CREATE TABLE facilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   text NOT NULL,
  title       text,
  body        text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_facilities_active_order ON facilities(is_active, sort_order);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON facilities
  FOR ALL USING (auth.role() = 'service_role');

-- Backfill the 6 items that were previously hardcoded, so the homepage
-- section doesn't go blank the moment this ships — using the same local
-- asset paths and English copy that were already live. The owner can
-- replace these with real Cloudinary photos via the new dashboard page.
INSERT INTO facilities (image_url, title, body, sort_order) VALUES
  ('/assets/steam-room.jpg', 'Herbal Steam Room', 'Private rooms infused with lemongrass, kaffir lime and eucalyptus.', 0),
  ('/assets/sauna.jpg',      'Finnish Sauna',      'Dry heat in a traditional wooden cabin — up to 95°C.', 1),
  ('/assets/cold-bath.jpg',  'Cold Plunge Pool',   'Crisp 10–15°C immersion to seal the circuit and invigorate the body.', 2),
  ('/assets/pool-day.jpg',   'Pool & Jacuzzi',     'Linger in warm mineral water beneath palms after your circuit.', 3),
  ('/assets/garden-2.jpg',   'Tropical Garden',    'Three rai of bamboo, palms and tropical flowers for pure garden calm.', 4),
  ('/assets/restaurant.jpg', 'Garden Restaurant',  'Healthy Thai and fusion dishes served open-air, all day.', 5);
