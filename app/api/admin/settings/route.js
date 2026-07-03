import { requireOwnerOrAbove } from '@/lib/require-admin'

// Keys an `owner` account may change. Everything else in site_content's
// settings page is super_admin-only — the agency's business-model levers
// (booking engine, chatbot mode, premium feature flags), not the client's.
const OWNER_ALLOWED_KEYS = ['settings.announcement_enabled', 'settings.maintenance_mode']

export async function PATCH(req) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() // { key: value_text }
  const entries = Object.entries(body)
  if (entries.length === 0) return Response.json({ error: 'No settings provided' }, { status: 400 })

  if (auth.profile.role === 'owner') {
    const disallowed = entries.map(([key]) => key).filter(key => !OWNER_ALLOWED_KEYS.includes(key))
    if (disallowed.length > 0) {
      return Response.json({
        error: `Not allowed to change: ${disallowed.join(', ')}. Only announcement banner and maintenance mode can be changed by an owner account.`,
      }, { status: 403 })
    }
  }

  const rows = entries.map(([key, value_text]) => ({ key, value_text: String(value_text), page: 'settings' }))

  const { error } = await auth.admin.from('site_content').upsert(rows, { onConflict: 'key' })
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true })
}
