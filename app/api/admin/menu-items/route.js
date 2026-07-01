import { requireAdmin } from '@/lib/require-admin'

export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  if (!body.name || !body.category_id) return Response.json({ error: 'Name and category are required' }, { status: 400 })

  const row = {
    category_id:    body.category_id,
    name:           body.name,
    description:    body.description ?? null,
    price:          body.price ?? null,
    price_note:     body.price_note ?? null,
    badge:          body.badge ?? null,
    is_recommended: body.is_recommended ?? false,
    is_active:      body.is_active ?? true,
    sort_order:     body.sort_order ?? 0,
  }

  const { data, error } = await auth.admin.from('menu_items').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, item: data })
}
