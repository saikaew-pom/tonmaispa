import { requireAdmin } from '@/lib/require-admin'

const EDITABLE = ['day_of_week', 'first_slot', 'last_slot', 'slot_interval', 'max_concurrent', 'is_active']

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const updates = {}
  for (const k of EDITABLE) {
    if (k in body) updates[k] = k === 'slot_interval' || k === 'max_concurrent' ? Number(body[k]) : body[k]
  }
  if (!Object.keys(updates).length) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await auth.admin.from('slot_settings').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, rule: data })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.admin.from('slot_settings').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
