import { requireOwnerOrAbove } from '@/lib/require-admin'

// GET /api/admin/banners — list all banners for the dashboard
export async function GET() {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data: banners, error } = await auth.admin
    .from('banners')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ banners: banners ?? [] })
}

// POST /api/admin/banners — create a new banner
export async function POST(req) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { name, message, image_url, cta_type, cta_label, cta_value, trigger_type, delay_seconds, start_date, end_date, is_active, priority } = body

  if (!name || !message) {
    return Response.json({ error: 'Name and message are required' }, { status: 400 })
  }

  const { data: banner, error } = await auth.admin
    .from('banners')
    .insert({
      name, message,
      image_url:  image_url || null,
      cta_type:   cta_type || 'none',
      cta_label:  cta_label || null,
      cta_value:  cta_value || null,
      trigger_type:  trigger_type || 'immediate',
      delay_seconds: trigger_type === 'delay' ? (delay_seconds || 10) : null,
      start_date: start_date || null,
      end_date:   end_date || null,
      is_active:  is_active ?? true,
      priority:   priority ?? 0,
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ banner })
}
