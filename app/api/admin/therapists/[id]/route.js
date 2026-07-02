import { requireAdmin } from '@/lib/require-admin'

const EDITABLE = ['name', 'specialties', 'photo_url', 'is_active', 'sort_order']

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const updates = {}
  for (const k of EDITABLE) if (k in body) updates[k] = body[k]

  let therapist = null
  if (Object.keys(updates).length) {
    const { data, error } = await auth.admin.from('therapists').update(updates).eq('id', params.id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    therapist = data
  }

  // Capability editor sends the full desired set of treatment ids — diff
  // against the junction table rather than requiring separate add/remove calls.
  if (Array.isArray(body.treatment_ids)) {
    const { data: existing } = await auth.admin.from('therapist_treatments').select('treatment_id').eq('therapist_id', params.id)
    const existingIds = new Set((existing ?? []).map(r => r.treatment_id))
    const nextIds = new Set(body.treatment_ids)

    const toAdd    = [...nextIds].filter(id => !existingIds.has(id))
    const toRemove = [...existingIds].filter(id => !nextIds.has(id))

    if (toAdd.length) {
      const { error } = await auth.admin.from('therapist_treatments').insert(toAdd.map(treatment_id => ({ therapist_id: params.id, treatment_id })))
      if (error) return Response.json({ error: error.message }, { status: 400 })
    }
    if (toRemove.length) {
      const { error } = await auth.admin.from('therapist_treatments').delete().eq('therapist_id', params.id).in('treatment_id', toRemove)
      if (error) return Response.json({ error: error.message }, { status: 400 })
    }
  }

  if (!Object.keys(updates).length && !Array.isArray(body.treatment_ids)) {
    return Response.json({ error: 'No valid fields' }, { status: 400 })
  }

  if (!therapist) {
    const { data } = await auth.admin.from('therapists').select().eq('id', params.id).single()
    therapist = data
  }

  return Response.json({ ok: true, therapist })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.admin.from('therapists').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
