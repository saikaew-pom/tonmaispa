import { requireAdmin } from '@/lib/require-admin'

// PATCH /api/profile — { fullName }
// Self-service only: always updates the caller's own row (auth.session.user.id),
// never a client-supplied id — any authenticated dashboard account (staff and
// above) can edit their own display name.
export async function PATCH(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { fullName } = await req.json()
  if (!fullName || !fullName.trim()) {
    return Response.json({ error: 'Full name is required' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', auth.session.user.id)
    .select('id, full_name, role')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ profile: data })
}
