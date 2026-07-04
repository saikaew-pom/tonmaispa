import { requireAdmin } from '@/lib/require-admin'

// PATCH /api/admin/facilities/[id] — { image_url?, title?, body?, sort_order?, is_active? }
export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()

  const allowedKeys = ['image_url', 'title', 'body', 'sort_order', 'is_active']
  const updates = { updated_at: new Date().toISOString() }
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key]
  }

  const { data: facility, error } = await auth.admin
    .from('facilities').update(updates).eq('id', id)
    .select('*').single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ facility })
}

// DELETE /api/admin/facilities/[id]
export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { error } = await auth.admin.from('facilities').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
