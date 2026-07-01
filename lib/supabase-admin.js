// Service role client — use in API routes and ISR pages
// Cookieless: safe for static generation and server-side API routes.
// Bypasses RLS — every query must filter to public/active rows explicitly.
import { createClient } from '@supabase/supabase-js'

export const createSupabaseAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
