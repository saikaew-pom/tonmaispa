-- ============================================================
-- TON MAI SPA — Revenue & Marketing Advisor
-- Persists every AI-generated recommendation (revenue + marketing
-- perspectives) so past advice can be re-viewed without re-paying the
-- MiniMax cost, and so the exact aggregated data sent to the AI is
-- auditable (input_summary never contains guest PII — see lib/insights.js).
-- ============================================================

CREATE TABLE revenue_insights (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  requested_by      uuid REFERENCES profiles,
  input_summary     jsonb NOT NULL,
  recommendations   jsonb NOT NULL,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_revenue_insights_created ON revenue_insights(created_at DESC);

ALTER TABLE revenue_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON revenue_insights
  FOR ALL USING (auth.role() = 'service_role');
