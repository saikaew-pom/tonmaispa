-- ============================================================
-- TON MAI SPA — Cookie Consent Log (GDPR Art. 7(1) + Thailand PDPA)
-- Both laws require the data controller to be able to DEMONSTRATE
-- that consent was given — this table is the audit trail, not the
-- source of truth for current preferences (that's the visitor's
-- own browser storage, read back on every page load).
-- ============================================================

CREATE TABLE cookie_consents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id       text NOT NULL,             -- random UUID minted client-side, stored in localStorage
  necessary        bool NOT NULL DEFAULT true,
  analytics        bool NOT NULL DEFAULT false,
  consent_version  text NOT NULL,             -- matches CONSENT_VERSION in lib/consent.js — track re-consent when policy changes
  action           text NOT NULL CHECK (action IN ('accept_all', 'reject_all', 'save_preferences')),
  page_url         text,
  ip_hash          text,                      -- SHA-256 of IP — enough for audit/abuse checks, not reversible to the raw IP
  user_agent       text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_cookie_consents_consent_id  ON cookie_consents(consent_id);
CREATE INDEX idx_cookie_consents_created_at  ON cookie_consents(created_at);

ALTER TABLE cookie_consents ENABLE ROW LEVEL SECURITY;

-- Anyone can log their own consent decision (public form, no auth)
CREATE POLICY "public_insert_cookie_consent" ON cookie_consents
  FOR INSERT WITH CHECK (true);

-- Only authenticated dashboard staff can read the log (audit lookups)
CREATE POLICY "auth_read_cookie_consents" ON cookie_consents
  FOR SELECT USING (auth.uid() IS NOT NULL);
