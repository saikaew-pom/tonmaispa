-- ============================================================
-- TON MAI SPA — Fix handle_new_user() missing search_path
-- SECURITY DEFINER functions run without a guaranteed search_path.
-- The trigger fires on auth.users insert, and without an explicit
-- search_path it can't resolve the unqualified `profiles` table
-- (in the public schema), causing "Database error creating new
-- user" on every signup / admin.createUser() call.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
