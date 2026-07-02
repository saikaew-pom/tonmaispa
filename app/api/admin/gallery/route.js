import { requireAdmin } from '@/lib/require-admin'

export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  if (!body.cloudinary_url) return Response.json({ error: 'cloudinary_url is required' }, { status: 400 })

  const row = {
    cloudinary_url: body.cloudinary_url,
    alt_text:       body.alt_text ?? null,
    category:       body.category ?? null,
    featured:       body.featured ?? true,
    sort_order:     body.sort_order ?? 0,
  }

  const { data, error } = await auth.admin.from('gallery_photos').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, photo: data })
}
