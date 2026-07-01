import { requireAdmin } from '@/lib/require-admin'

// The availability API reads slot rules with .maybeSingle() — one global rule
// (treatment_id IS NULL) and at most one rule per treatment. Creating a second
// rule for the same scope would make those reads throw, so we guard against it.
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const treatmentId = body.treatment_id || null

  // Reject a duplicate rule for the same scope
  const existing = await auth.admin
    .from('slot_settings')
    .select('id')
    [treatmentId ? 'eq' : 'is']('treatment_id', treatmentId)
    .limit(1)
  if (existing.data?.length) {
    return Response.json({
      error: treatmentId
        ? 'A rule for this treatment already exists — edit it instead.'
        : 'A global rule already exists — edit it instead.',
    }, { status: 409 })
  }

  const row = {
    treatment_id:   treatmentId,
    day_of_week:    Array.isArray(body.day_of_week) ? body.day_of_week : [0, 1, 2, 3, 4, 5, 6],
    first_slot:     body.first_slot || '09:00',
    last_slot:      body.last_slot  || '22:00',
    slot_interval:  Number(body.slot_interval) || 30,
    max_concurrent: Number(body.max_concurrent) || 3,
    is_active:      body.is_active ?? true,
  }

  const { data, error } = await auth.admin.from('slot_settings').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ ok: true, rule: data })
}
