import { requireAdmin } from '@/lib/require-admin'

const EDITABLE = ['alt_text', 'category', 'featured', 'sort_order']

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.includes(k)))
  if (Object.keys(updates).length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await auth.admin.from('gallery_photos').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, photo: data })
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.admin.from('gallery_photos').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
