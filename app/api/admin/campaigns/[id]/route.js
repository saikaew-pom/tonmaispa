import { requireAdmin } from '@/lib/require-admin'

const VALID_STATUSES = ['draft', 'active', 'completed', 'archived']

// PATCH /api/admin/campaigns/[id] — { name?, status? }
export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { name, status } = await req.json()

  if (status && !VALID_STATUSES.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updates = { updated_at: new Date().toISOString() }
  if (name) updates.name = name
  if (status) updates.status = status

  const { data, error } = await auth.admin
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('id, name, status')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ campaign: data })
}

// DELETE /api/admin/campaigns/[id] — removes a draft campaign
export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { error } = await auth.admin.from('campaigns').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
