import { requireAdmin } from '@/lib/require-admin'

export async function PATCH(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() // { key: value_text }
  const entries = Object.entries(body)
  if (entries.length === 0) return Response.json({ error: 'No settings provided' }, { status: 400 })

  const rows = entries.map(([key, value_text]) => ({ key, value_text: String(value_text), page: 'settings' }))

  const { error } = await auth.admin.from('site_content').upsert(rows, { onConflict: 'key' })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
