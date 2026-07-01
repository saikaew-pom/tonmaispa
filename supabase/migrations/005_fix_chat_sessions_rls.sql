-- ============================================================
-- TON MAI SPA — Lock down chat_sessions RLS
-- Previously: public_read / public_insert / public_update allowed
-- anyone with the anon key to read any guest's name + full chat
-- history by guessing/knowing their phone number (guest_phone
-- lookup had no session ownership check).
-- Fix: all chat_sessions access now goes through /api/chat/*
-- routes using the service-role admin client, which bypasses RLS.
-- The browser no longer talks to this table directly.
-- ============================================================

DROP POLICY IF EXISTS "public_insert_chat_session" ON chat_sessions;
DROP POLICY IF EXISTS "public_update_chat_session" ON chat_sessions;
DROP POLICY IF EXISTS "public_read_chat_session"   ON chat_sessions;

-- No public policies remain — RLS stays enabled with zero policies,
-- so all access requires the service-role key (server-side only).
