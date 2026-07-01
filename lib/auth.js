// Auth guards for API routes and dashboard pages
// Usage in API route:
//   const auth = await requireRole(req, ['super_admin', 'admin'])
//   if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

import { createSupabaseServerClient } from './supabase-server'

const ROLE_HIERARCHY = {
  super_admin: 3,
  admin:       2,
  staff:       1,
}

/**
 * Verify the current user has at least one of the allowed roles.
 * Returns { session, profile } on success, or { error, status } on failure.
 */
export async function requireRole(allowedRoles = ['staff', 'admin', 'super_admin']) {
  const supabase = await createSupabaseServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    return { error: 'Profile not found', status: 403 }
  }

  if (!allowedRoles.includes(profile.role)) {
    return { error: 'Insufficient permissions', status: 403 }
  }

  return { session, profile }
}

// Shorthand guards
export const requireAdmin      = () => requireRole(['admin', 'super_admin'])
export const requireSuperAdmin = () => requireRole(['super_admin'])
export const requireAnyStaff   = () => requireRole(['staff', 'admin', 'super_admin'])

/**
 * Check if a role can perform an action on another role.
 * Used in user management — e.g. admin cannot demote another admin.
 */
export function canManageRole(actorRole, targetRole) {
  return (ROLE_HIERARCHY[actorRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0)
}
