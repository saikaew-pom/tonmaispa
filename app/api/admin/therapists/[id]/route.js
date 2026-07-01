import { requireAdmin } from '@/lib/require-admin'

const EDITABLE = ['name', 'specialties', 'photo_url', 'is_active', 'sort_order']

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const updates = {}
  for (const k of EDITABLE) if (k in body) updates[k] = body[k]
  if (!Object.keys(updates).length) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await auth.admin.from('therapists').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, therapist: data })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.admin.from('therapists').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
