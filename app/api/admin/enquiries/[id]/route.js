import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const body = await req.json()
  const allowed = ['status']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await auth.admin.from('enquiries').update(updates).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, enquiry: data })
}
