-- ============================================================
-- TON MAI SPA — Blog module: dashboard-editable posts published at
-- /blog on the public site, with AI-assisted drafting/excerpting.
-- ============================================================

-- An empty blog_posts table with a different, unused schema (body_html,
-- hero_url, status, published_at, meta_title, meta_desc — no category or
-- author_name) already existed from earlier, unrelated work. Confirmed
-- empty (0 rows) and safe to replace before this module's schema goes in.
DROP TABLE IF EXISTS blog_posts CASCADE;

CREATE TABLE blog_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  slug               text NOT NULL UNIQUE,
  category           text NOT NULL,
  excerpt            text,
  cover_image_url    text,
  body               text,               -- rich text stored as HTML
  author_name        text,
  tags               text[] DEFAULT '{}',
  publish_date       date NOT NULL DEFAULT CURRENT_DATE,
  read_time_minutes  integer,            -- auto-computed from word count, editable override
  is_published       boolean NOT NULL DEFAULT false,
  is_featured        boolean NOT NULL DEFAULT false,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, publish_date DESC);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');
