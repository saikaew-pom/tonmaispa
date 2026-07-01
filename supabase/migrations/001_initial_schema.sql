-- ============================================================
-- TON MAI SPA — Full Schema Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ── PROFILES (linked to auth.users) ──────────────────────────
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name   text,
  role        text CHECK (role IN ('super_admin','admin','staff')) DEFAULT 'staff',
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);

-- ── SITE CONTENT (all CMS text / settings) ───────────────────
CREATE TABLE site_content (
  key          text PRIMARY KEY,           -- e.g. "hero.headline", "settings.whatsapp"
  value_text   text,
  value_rich   text,
  page         text,                        -- "home", "spa-menu", "restaurant", "global"
  section      text,
  updated_at   timestamptz DEFAULT now()
);

-- ── SITE SETTINGS (feature toggles) ──────────────────────────
-- Stored in site_content with page='settings'. Key examples:
--   settings.booking_engine_enabled   = "true" | "false"
--   settings.chatbot_enabled          = "true" | "false"
--   settings.whatsapp_number          = "66631175211"
--   settings.line_id                  = "@tonmaispa"
--   settings.opening_hours            = "09:00–23:00"
--   settings.google_rating            = "4.8"
--   settings.google_review_count      = "369"

-- ── SPA TREATMENTS ────────────────────────────────────────────
CREATE TABLE spa_treatments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE NOT NULL,
  description      text,
  category         text,                    -- "massage","body","cbd","package","thermal"
  duration_options int[],                   -- [60, 90, 120]
  prices           jsonb,                   -- {"60": 400, "90": 580, "120": 750}
  badge            text,                    -- "Signature","Premium","CBD","Package"
  sort_order       int DEFAULT 0,
  is_active        bool DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- ── MENU CATEGORIES ───────────────────────────────────────────
CREATE TABLE menu_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  type        text,                          -- "food","drink","cocktail","wine","snack"
  sort_order  int DEFAULT 0
);

-- ── MENU ITEMS ────────────────────────────────────────────────
CREATE TABLE menu_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid REFERENCES menu_categories ON DELETE SET NULL,
  name            text NOT NULL,
  description     text,
  price           int,                       -- THB
  price_note      text,                      -- "200/240 domestic/imported"
  badge           text,
  tags            text[],
  is_recommended  bool DEFAULT false,
  is_active       bool DEFAULT true,
  sort_order      int DEFAULT 0
);

-- ── GALLERY PHOTOS ────────────────────────────────────────────
CREATE TABLE gallery_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudinary_url  text NOT NULL,
  alt_text        text,
  category        text,
  featured        bool DEFAULT false,
  sort_order      int DEFAULT 0,
  uploaded_at     timestamptz DEFAULT now()
);

-- ── BLOG POSTS ────────────────────────────────────────────────
CREATE TABLE blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  slug          text UNIQUE NOT NULL,
  body_html     text,
  excerpt       text,
  hero_url      text,
  meta_title    text,
  meta_desc     text,
  tags          text[],
  status        text CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
  published_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- ── ENQUIRIES (contact form + chatbot + simple booking requests) ──
CREATE TABLE enquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text,
  email        text,
  phone        text,
  message      text,
  source       text DEFAULT 'contact_form',  -- "contact_form","chatbot","booking_request","walk_in"
  status       text CHECK (status IN ('new','replied','closed')) DEFAULT 'new',
  staff_notes  text,
  metadata     jsonb,                         -- {treatment_interest, preferred_date, chat_session_id}
  created_at   timestamptz DEFAULT now()
);

-- ── CHAT SESSIONS ─────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text UNIQUE NOT NULL,        -- localStorage UUID (device fingerprint)
  guest_name    text,                        -- extracted from conversation
  guest_phone   text,                        -- extracted from conversation — lookup key
  messages      jsonb DEFAULT '[]'::jsonb,   -- [{role, content, timestamp, tool_call?}]
  metadata      jsonb DEFAULT '{}'::jsonb,   -- {interests[], mentioned_treatments[], visit_intent, preferred_date}
  last_active   timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_sessions_phone ON chat_sessions(guest_phone) WHERE guest_phone IS NOT NULL;
CREATE INDEX idx_chat_sessions_last_active ON chat_sessions(last_active);

-- ── THERAPISTS ────────────────────────────────────────────────
CREATE TABLE therapists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  photo_url    text,
  specialties  text[],
  is_active    bool DEFAULT true,
  sort_order   int DEFAULT 0
);

-- ── SLOT SETTINGS (per treatment or global) ───────────────────
CREATE TABLE slot_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id    uuid REFERENCES spa_treatments ON DELETE CASCADE,  -- NULL = applies to all
  day_of_week     int[],                     -- [0,1,2,3,4,5,6] — NULL = every day
  first_slot      time NOT NULL DEFAULT '09:00',
  last_slot       time NOT NULL DEFAULT '21:00',
  slot_interval   int NOT NULL DEFAULT 30,   -- minutes between slot starts
  max_concurrent  int NOT NULL DEFAULT 3,    -- max bookings at same time
  is_active       bool DEFAULT true
);

-- ── BLOCKED DATES ─────────────────────────────────────────────
CREATE TABLE blocked_dates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  uuid REFERENCES therapists ON DELETE CASCADE,  -- NULL = whole spa blocked
  date          date NOT NULL,
  reason        text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_blocked_dates_date ON blocked_dates(date);

-- ── BOOKINGS ──────────────────────────────────────────────────
CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code        text UNIQUE NOT NULL,      -- TMS-001, TMS-002…
  guest_name      text NOT NULL,
  guest_email     text,
  guest_phone     text NOT NULL,
  treatment_id    uuid REFERENCES spa_treatments ON DELETE SET NULL,
  therapist_id    uuid REFERENCES therapists ON DELETE SET NULL,
  date            date NOT NULL,
  time_slot       time NOT NULL,
  duration        int NOT NULL,              -- minutes
  price           int,                       -- THB at time of booking
  status          text CHECK (status IN ('pending','confirmed','cancelled','completed')) DEFAULT 'pending',
  source          text DEFAULT 'online',     -- "online","walk_in","phone","chatbot"
  notes           text,                      -- guest notes
  staff_notes     text,
  chat_session_id text,                      -- link back to chat_sessions.session_id
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_phone ON bookings(guest_phone);

-- ── REF CODE SEQUENCE ─────────────────────────────────────────
CREATE SEQUENCE booking_ref_seq START 1;

-- Auto-generate ref_code on insert
CREATE OR REPLACE FUNCTION set_booking_ref_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ref_code IS NULL OR NEW.ref_code = '' THEN
    NEW.ref_code := 'TMS-' || LPAD(nextval('booking_ref_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_ref_code_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_booking_ref_code();

-- Auto-update updated_at on bookings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── PROFILE TRIGGER (on new auth user) ───────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
