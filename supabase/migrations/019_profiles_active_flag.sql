-- ============================================================
-- TON MAI SPA — deactivate/reactivate flag for user management.
-- Mirrors the real Supabase Auth ban state (set via admin.auth.admin
-- .updateUserById in app/api/admin/users/[id]/route.js) so the dashboard
-- can display status without an extra Auth Admin API call per row.
-- ============================================================

ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
