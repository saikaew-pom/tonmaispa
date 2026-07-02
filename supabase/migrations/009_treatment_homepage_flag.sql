-- ============================================================
-- TON MAI SPA — Treatment "Show on Homepage" flag
-- Lets staff explicitly choose which treatments appear in the
-- homepage Services section, independent of the full spa-menu
-- listing. Existing sort_order still controls display order.
-- ============================================================

ALTER TABLE spa_treatments ADD COLUMN show_on_homepage boolean DEFAULT false;
