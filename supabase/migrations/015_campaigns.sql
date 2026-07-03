-- ============================================================
-- TON MAI SPA — AI Campaign Planner
-- Stores guided-brief inputs, injected business context, and all three
-- generation stages (draft, critique, final plan) so past campaigns can be
-- revisited and the AI's self-correction can be audited.
-- ============================================================

CREATE TABLE campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  objective     text NOT NULL,
  budget_thb    numeric,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  audience      text,
  constraints   text,
  status        text NOT NULL DEFAULT 'draft', -- draft | active | completed | archived
  input_context jsonb NOT NULL,
  draft_plan    jsonb,
  critique      jsonb,
  plan          jsonb NOT NULL,
  requested_by  uuid REFERENCES profiles,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_campaigns_created ON campaigns(created_at DESC);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON campaigns
  FOR ALL USING (auth.role() = 'service_role');
