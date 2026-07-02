-- ============================================================
-- TON MAI SPA — Content Translations Cache
-- Caches MiniMax AI translations of CMS content (treatments,
-- settings text, gallery alt text) per locale, so translation only
-- happens once per piece of content, not on every page request.
-- source_id is a text column so it can hold either a row UUID (cast
-- to text) or a site_content.key string, since site_content has no
-- single-column primary key.
-- ============================================================

CREATE TABLE content_translations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table    text NOT NULL,
  source_id       text NOT NULL,
  field           text NOT NULL,
  locale          text NOT NULL,
  original_text   text NOT NULL,
  translated_text text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (source_table, source_id, field, locale)
);

CREATE INDEX idx_content_translations_lookup ON content_translations(source_table, source_id, locale);

ALTER TABLE content_translations ENABLE ROW LEVEL SECURITY;

-- Service-role only — this table is read/written exclusively by
-- server-side code via the admin client, never directly by browsers.
CREATE POLICY "Service role full access" ON content_translations
  FOR ALL USING (auth.role() = 'service_role');
