-- ============================================================
-- TON MAI SPA — Revenue & Marketing Advisor gets the same
-- 3-stage self-critique pipeline (draft -> critique -> distill)
-- already used by the Campaign Planner. These columns store the
-- intermediate stages alongside the final recommendations for
-- audit/fact-check purposes.
-- ============================================================

ALTER TABLE revenue_insights
  ADD COLUMN draft_recommendations jsonb,
  ADD COLUMN critique               jsonb;
