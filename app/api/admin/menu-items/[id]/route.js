import { requireAdmin } from '@/lib/require-admin'

const EDITABLE = ['name', 'description', 'price', 'price_note', 'badge', 'is_recommended', 'is_active', 'sort_order', 'category_id']

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.includes(k)))
  if (Object.keys(updates).length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await auth.admin.from('menu_items').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, item: data })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.admin.from('menu_items').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
