import { requireAdmin } from '@/lib/require-admin'

export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  if (!body.name) return Response.json({ error: 'Name is required' }, { status: 400 })

  const row = {
    name:        body.name,
    specialties: Array.isArray(body.specialties) ? body.specialties : [],
    photo_url:   body.photo_url || null,
    is_active:   body.is_active ?? true,
    sort_order:  Number(body.sort_order) || 0,
  }

  const { data, error } = await auth.admin.from('therapists').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, therapist: data })
}
