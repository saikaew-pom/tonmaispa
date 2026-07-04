import { requireOwnerOrAbove } from '@/lib/require-admin'

// PATCH /api/admin/banners/[id] — partial update, any field
export async function PATCH(req, { params }) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()

  const allowedKeys = ['name', 'message', 'image_url', 'cta_type', 'cta_label', 'cta_value', 'trigger_type', 'delay_seconds', 'start_date', 'end_date', 'is_active', 'priority']
  const updates = { updated_at: new Date().toISOString() }
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key]
  }
  // A delay trigger without a delay is meaningless; an immediate trigger
  // ignores delay_seconds entirely — keep the stored value honest.
  if (updates.trigger_type === 'immediate') updates.delay_seconds = null
  if (updates.trigger_type === 'delay' && !updates.delay_seconds) updates.delay_seconds = 10

  const { data: banner, error } = await auth.admin
    .from('banners').update(updates).eq('id', id)
    .select('*').single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ banner })
}

// DELETE /api/admin/banners/[id]
export async function DELETE(req, { params }) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { error } = await auth.admin.from('banners').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
