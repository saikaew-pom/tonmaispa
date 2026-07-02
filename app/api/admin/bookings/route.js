import { requireAdmin } from '@/lib/require-admin'

// POST /api/admin/bookings — staff-created bookings (phone, walk-in, etc).
// Unlike the public /api/bookings route, this skips Turnstile/rate-limiting
// (already behind requireAdmin) and doesn't re-check slot capacity — staff
// are trusted to know when they're intentionally overbooking a slot.
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { guest_name, guest_phone, guest_email, treatment_id, therapist_id, date, time_slot, duration, status, source, notes } = body

  if (!guest_name || !guest_phone || !treatment_id || !date || !time_slot || !duration) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: treatment } = await auth.admin
    .from('spa_treatments')
    .select('prices')
    .eq('id', treatment_id)
    .maybeSingle()
  const price = treatment?.prices?.[String(duration)] ?? null

  const { data: booking, error } = await auth.admin
    .from('bookings')
    .insert({
      guest_name,
      guest_phone,
      guest_email:  guest_email || null,
      treatment_id,
      therapist_id: therapist_id || null,
      date,
      time_slot,
      duration,
      price,
      status:       status || 'confirmed',
      source:       source || 'phone',
      notes:        notes || null,
    })
    .select('id, ref_code, guest_name, guest_phone, guest_email, date, time_slot, duration, status, source, notes, spa_treatments(name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, booking })
}
