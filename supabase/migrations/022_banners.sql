-- ============================================================
-- TON MAI SPA — Banners: multiple scheduled/triggered popup banners,
-- replacing the single announcement_* settings fields.
-- ============================================================

CREATE TABLE banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                 -- internal label, e.g. "Songkran 2026"
  message       text NOT NULL,
  image_url     text,
  cta_type      text NOT NULL DEFAULT 'none' CHECK (cta_type IN ('none', 'whatsapp', 'call', 'url')),
  cta_label     text,
  cta_value     text,                          -- phone number override or URL; null + cta_type='whatsapp'/'call'
                                                -- falls back to settings.whatsapp_number at render time
  trigger_type  text NOT NULL DEFAULT 'immediate' CHECK (trigger_type IN ('immediate', 'delay')),
  delay_seconds integer,                       -- used when trigger_type = 'delay'
  start_date    date,                          -- null = no start restriction
  end_date      date,                          -- null = no end restriction
  is_active     boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,    -- higher shows first when multiple are eligible at once
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_banners_eligibility ON banners(is_active, start_date, end_date, priority DESC);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON banners
  FOR ALL USING (auth.role() = 'service_role');

-- The old single-banner settings fields (announcement_enabled/text/link/
-- link_label) are superseded by this table and no longer read by the site.
-- Left in site_content harmlessly rather than deleted (no destructive delete
-- needed — they're just dead keys now).
