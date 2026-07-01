import { requireAdmin } from '@/lib/require-admin'

export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const date = body.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Invalid date' }, { status: 400 })
  }
  const therapistId = body.therapist_id || null

  // Don't create a duplicate block for the same date + scope
  const existing = await auth.admin
    .from('blocked_dates')
    .select('id')
    .eq('date', date)
    [therapistId ? 'eq' : 'is']('therapist_id', therapistId)
    .limit(1)
  if (existing.data?.length) {
    return Response.json({ ok: true, block: { id: existing.data[0].id, date, therapist_id: therapistId, reason: body.reason ?? null } })
  }

  const { data, error } = await auth.admin.from('blocked_dates').insert({
    date,
    therapist_id: therapistId,
    reason:       body.reason || null,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, block: data })
}
