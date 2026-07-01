-- ============================================================
-- TON MAI SPA — Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content    ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_treatments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;

-- ── PUBLIC READ (anon key — ISR pages, public site) ───────────

-- Anyone can read active treatments (spa menu page)
CREATE POLICY "public_read_active_treatments" ON spa_treatments
  FOR SELECT USING (is_active = true);

-- Anyone can read active menu items and categories (restaurant page)
CREATE POLICY "public_read_menu_categories" ON menu_categories
  FOR SELECT USING (true);

CREATE POLICY "public_read_active_menu_items" ON menu_items
  FOR SELECT USING (is_active = true);

-- Anyone can read gallery photos (homepage, gallery page)
CREATE POLICY "public_read_gallery" ON gallery_photos
  FOR SELECT USING (true);

-- Anyone can read published blog posts
CREATE POLICY "public_read_published_posts" ON blog_posts
  FOR SELECT USING (status = 'published');

-- Anyone can read site content (homepage sections, settings)
CREATE POLICY "public_read_site_content" ON site_content
  FOR SELECT USING (true);

-- Anyone can read active therapists (booking form)
CREATE POLICY "public_read_active_therapists" ON therapists
  FOR SELECT USING (is_active = true);

-- Anyone can read slot settings and blocked dates (availability check)
CREATE POLICY "public_read_slot_settings" ON slot_settings
  FOR SELECT USING (is_active = true);

CREATE POLICY "public_read_blocked_dates" ON blocked_dates
  FOR SELECT USING (true);

-- ── PUBLIC WRITE (anon key — forms, chatbot) ──────────────────

-- Anyone can create an enquiry (contact form, chatbot)
CREATE POLICY "public_insert_enquiries" ON enquiries
  FOR INSERT WITH CHECK (true);

-- Anyone can upsert their own chat session (by session_id — not user auth)
CREATE POLICY "public_insert_chat_session" ON chat_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_update_chat_session" ON chat_sessions
  FOR UPDATE USING (true);

CREATE POLICY "public_read_chat_session" ON chat_sessions
  FOR SELECT USING (true);

-- Anyone can create a booking (booking form)
CREATE POLICY "public_insert_booking" ON bookings
  FOR INSERT WITH CHECK (true);

-- ── AUTHENTICATED READ (dashboard) ────────────────────────────

-- Authenticated users can read everything
CREATE POLICY "auth_read_profiles" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_enquiries" ON enquiries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_all_bookings" ON bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_all_treatments" ON spa_treatments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_all_menu_items" ON menu_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_all_blog_posts" ON blog_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── AUTHENTICATED WRITE (dashboard — via service role in API routes) ─
-- All dashboard writes go through /api/admin/* routes using the service
-- role client (createSupabaseAdminClient). The service role bypasses RLS.
-- These policies are safety nets for direct DB access only.

CREATE POLICY "auth_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
