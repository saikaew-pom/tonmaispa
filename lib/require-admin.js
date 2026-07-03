// Guards for /api/admin/* routes — confirm a logged-in session and read the
// caller's role from profiles. All writes then go through the service-role
// admin client, which bypasses RLS.
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

async function getSessionAndProfile() {
  // Next.js 15 requires cookies() to be awaited before use. Resolve the store
  // first, then hand auth-helpers a synchronous getter for the resolved store.
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized', status: 401 }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  return { session, profile, admin }
}

// Any authenticated staff-or-above — unchanged meaning, used by every
// operational route (bookings, availability, therapists, etc.).
export async function requireAdmin() {
  const result = await getSessionAndProfile()
  if (result.error) return result

  if (!result.profile || !['super_admin', 'owner', 'staff'].includes(result.profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }
  return result
}

// super_admin or owner only — used by Users management and the two
// owner-allowed Settings keys.
export async function requireOwnerOrAbove() {
  const result = await getSessionAndProfile()
  if (result.error) return result

  if (!result.profile || !['super_admin', 'owner'].includes(result.profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }
  return result
}

// super_admin only — used by every Settings key besides the two operational
// toggles, and any future role-escalation action.
export async function requireSuperAdmin() {
  const result = await getSessionAndProfile()
  if (result.error) return result

  if (!result.profile || result.profile.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403 }
  }
  return result
}
