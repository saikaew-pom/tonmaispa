// POST /api/consent — logs a cookie-consent decision for audit purposes.
// Public, no auth (every visitor needs to log a decision). Rate-limited and
// stores only a hashed IP, never the raw address, since this is a compliance
// log, not a tracking mechanism.

import { createHash } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'

function hashIp(ip) {
  if (!ip || ip === 'unknown') return null
  return createHash('sha256').update(ip).digest('hex')
}

export async function POST(req) {
  const rl = await checkRateLimit(req, 'consent', { limit: 20, window: 600 })
  if (!rl.success) return tooManyRequestsResponse()

  const body = await req.json()
  const { consent_id, analytics, action, consent_version, page_url } = body

  if (!consent_id || !action || !consent_version) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!['accept_all', 'reject_all', 'save_preferences'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('cookie_consents').insert({
    consent_id,
    necessary:       true,
    analytics:       !!analytics,
    consent_version,
    action,
    page_url:        page_url || null,
    ip_hash:         hashIp(ip),
    user_agent:      req.headers.get('user-agent') || null,
  })

  if (error) {
    console.error('[consent] insert error:', error)
    return Response.json({ error: 'Failed to log consent' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
