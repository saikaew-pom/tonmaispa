-- ============================================================
-- TON MAI SPA — Treatment Photos
-- Lets staff attach one or more photos per treatment in the CMS;
-- the public site shows a "View Photos" button only when at least
-- one photo exists.
-- ============================================================

ALTER TABLE spa_treatments ADD COLUMN photos text[] DEFAULT '{}';
