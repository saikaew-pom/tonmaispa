-- ============================================================
-- TON MAI SPA — premium feature flags for Insights + Campaign Planner
-- Seeded to 'true' so existing access is unchanged until you flip them
-- off in Settings → Feature Toggles for clients who haven't paid for
-- AI analytics access.
-- ============================================================

INSERT INTO site_content (key, value_text, page)
VALUES
  ('settings.insights_enabled',  'true', 'settings'),
  ('settings.campaigns_enabled', 'true', 'settings')
ON CONFLICT (key) DO NOTHING;
