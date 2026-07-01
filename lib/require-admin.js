// Guard for /api/admin/* routes — confirms a logged-in session and
// reads the caller's role from profiles. All writes then go through
// the service-role admin client, which bypasses RLS.
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized', status: 401 }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || !['super_admin', 'admin', 'staff'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }

  return { session, profile, admin }
}
