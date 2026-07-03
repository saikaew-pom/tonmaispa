import { requireAdmin } from '@/lib/require-admin'
import { checkSlotCapacity } from '@/lib/scheduling'

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// POST /api/admin/bookings — staff-created bookings (phone, walk-in, etc).
// Unlike the public /api/bookings route, this skips Turnstile/rate-limiting
// (already behind requireAdmin). Slot capacity (qualified therapist free +
// room free) IS enforced here too — a full slot must never be silently
// overbooked. Staff can still overbook deliberately, but only by passing
// overbook: true (the dashboard asks for explicit confirmation first).
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { guest_name, guest_phone, guest_email, treatment_id, therapist_id, date, time_slot, duration, status, source, notes, overbook } = body

  if (!guest_name || !guest_phone || !treatment_id || !date || !time_slot || !duration) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const [{ data: treatment }, capacity] = await Promise.all([
    auth.admin.from('spa_treatments').select('prices').eq('id', treatment_id).maybeSingle(),
    checkSlotCapacity(auth.admin, {
      treatmentId: treatment_id, date, startTime: time_slot, endTime: addMinutes(time_slot, duration),
    }),
  ])
  const price = treatment?.prices?.[String(duration)] ?? null

  if (!capacity.ok && !overbook) {
    const reason = capacity.reason === 'no_room'
      ? 'All treatment rooms are occupied at this time.'
      : 'No qualified therapist is free at this time.'
    return Response.json({
      error: `${reason} Tick "book anyway" to overbook this slot deliberately.`,
      code: 'SLOT_FULL',
    }, { status: 409 })
  }

  // Auto-assign only when staff didn't pick a therapist explicitly. On a
  // deliberate overbook there may be no free therapist — saved as null so
  // staff can resolve the assignment manually afterward.
  const autoTherapistIds = therapist_id ? null : capacity.therapistIds

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
