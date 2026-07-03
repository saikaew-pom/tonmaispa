-- ============================================================
-- TON MAI SPA — rename 'admin' role to 'owner' for clarity in a
-- single-client-per-deployment app, and prep the CHECK constraint
-- for the new three-tier permission model (super_admin/owner/staff).
-- ============================================================

UPDATE profiles SET role = 'owner' WHERE role = 'admin';

ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'owner', 'staff'));
