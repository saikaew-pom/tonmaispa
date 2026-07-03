import { requireOwnerOrAbove } from '@/lib/require-admin'

// Ban ~100 years out, matching the common Supabase-recipe convention for
// "indefinitely deactivated" (there's no dedicated boolean on auth.users).
const BAN_DURATION = '876000h'

// PATCH /api/admin/users/[id] — { role?, isActive? }
// owner: may only toggle isActive, and only on accounts that are (or are
//   becoming) 'staff' — role changes are super_admin only.
// super_admin: may change role to anything and toggle isActive on anyone.
export async function PATCH(req, { params }) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { role, isActive } = await req.json()

  const { data: target, error: targetError } = await auth.admin
    .from('profiles').select('role').eq('id', id).single()
  if (targetError || !target) return Response.json({ error: 'User not found' }, { status: 404 })

  if (auth.profile.role === 'owner') {
    if (role) return Response.json({ error: 'Only a super_admin can change a user\'s role' }, { status: 403 })
    if (target.role !== 'staff') return Response.json({ error: 'You can only manage staff accounts' }, { status: 403 })
  }

  if (role && !['super_admin', 'owner', 'staff'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const updates = {}
  if (role) updates.role = role
  if (typeof isActive === 'boolean') updates.is_active = isActive

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  if (typeof isActive === 'boolean') {
    const { error: banError } = await auth.admin.auth.admin.updateUserById(id, {
      ban_duration: isActive ? 'none' : BAN_DURATION,
    })
    if (banError) return Response.json({ error: banError.message }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('profiles').update(updates).eq('id', id)
    .select('id, full_name, role, is_active').single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ user: data })
}
