import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/facilities — list all, for the dashboard
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data: facilities, error } = await auth.admin
    .from('facilities').select('*').order('sort_order', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ facilities: facilities ?? [] })
}

// POST /api/admin/facilities — create a new facility card
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { image_url, title, body } = await req.json()
  if (!image_url) return Response.json({ error: 'Photo is required' }, { status: 400 })

  const { count } = await auth.admin.from('facilities').select('id', { count: 'exact', head: true })

  const { data: facility, error } = await auth.admin
    .from('facilities')
    .insert({ image_url, title: title || null, body: body || null, sort_order: count ?? 0 })
    .select('*').single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ facility })
}
