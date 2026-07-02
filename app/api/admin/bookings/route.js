import { requireAdmin } from '@/lib/require-admin'
import { findAvailableTherapists } from '@/lib/scheduling'

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// POST /api/admin/bookings — staff-created bookings (phone, walk-in, etc).
// Unlike the public /api/bookings route, this skips Turnstile/rate-limiting
// (already behind requireAdmin) and doesn't re-check slot capacity — staff
// are trusted to know when they're intentionally overbooking a slot. If no
// therapist is explicitly chosen, one is auto-assigned the same way the
// public flow does (falls back to null if none qualify/are free — staff can
// still save the booking and assign someone manually afterward).
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { guest_name, guest_phone, guest_email, treatment_id, therapist_id, date, time_slot, duration, status, source, notes } = body

  if (!guest_name || !guest_phone || !treatment_id || !date || !time_slot || !duration) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const [{ data: treatment }, autoTherapistIds] = await Promise.all([
    auth.admin.from('spa_treatments').select('prices').eq('id', treatment_id).maybeSingle(),
    therapist_id ? Promise.resolve(null) : findAvailableTherapists(auth.admin, {
      treatmentId: treatment_id, date, startTime: time_slot, endTime: addMinutes(time_slot, duration),
    }),
  ])
  const price = treatment?.prices?.[String(duration)] ?? null

  const { data: booking, error } = await auth.admin
    .from('bookings')
    .insert({
      guest_name,
      guest_phone,
      guest_email:  guest_email || null,
      treatment_id,
      therapist_id: therapist_id || autoTherapistIds?.[0] || null,
      secondary_therapist_id: therapist_id ? null : (autoTherapistIds?.[1] ?? null),
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
