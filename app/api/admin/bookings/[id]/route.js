import { requireAdmin } from '@/lib/require-admin'
import { checkSlotCapacity } from '@/lib/scheduling'
import { logBookingAction } from '@/lib/booking-logs'

const EDITABLE_FIELDS = [
  'guest_name', 'guest_phone', 'guest_email',
  'treatment_id', 'therapist_id', 'date', 'time_slot', 'duration',
  'status', 'source', 'notes', 'staff_notes',
]

// Fields that, if changed, require re-checking that a qualified therapist
// and a room are actually free for the new window — same rule the public
// site and chatbot already follow, so editing a booking can never silently
// create a double-booking. `excludeBookingId` treats this booking's own
// current slot as free rather than counting it against itself.
const CAPACITY_FIELDS = ['treatment_id', 'date', 'time_slot', 'duration']

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { data, error } = await auth.admin
    .from('bookings')
    .select('*, spa_treatments(name, duration_options)')
    .eq('id', id)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  if (!data) return Response.json({ error: 'Booking not found' }, { status: 404 })
  return Response.json({ booking: data })
}

export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const body = await req.json()
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE_FIELDS.includes(k)))

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: before, error: beforeError } = await auth.admin
    .from('bookings').select('*').eq('id', id).maybeSingle()
  if (beforeError || !before) return Response.json({ error: 'Booking not found' }, { status: 404 })

  const touchesCapacity = CAPACITY_FIELDS.some(f => f in updates && updates[f] !== before[f])
  if (touchesCapacity && !body.overbook) {
    const merged = { ...before, ...updates }
    const capacity = await checkSlotCapacity(auth.admin, {
      treatmentId: merged.treatment_id,
      date: merged.date,
      startTime: merged.time_slot.slice(0, 5),
      endTime: addMinutes(merged.time_slot.slice(0, 5), merged.duration),
      excludeBookingId: id,
    })
    if (!capacity.ok) {
      const reason = capacity.reason === 'no_room'
        ? 'All treatment rooms are occupied at this new time.'
        : 'No qualified therapist is free at this new time.'
      return Response.json({
        error: `${reason} Tick "save anyway" to overbook this slot deliberately.`,
        code: 'SLOT_FULL',
      }, { status: 409 })
    }
  }

  const { data, error } = await auth.admin.from('bookings').update(updates).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const changedFields = Object.keys(updates).filter(k => updates[k] !== before[k])
  if (changedFields.length) {
    const isOnlyStatus = changedFields.length === 1 && changedFields[0] === 'status'
    const detail = isOnlyStatus
      ? `status: ${before.status} → ${updates.status}`
      : changedFields.map(f => `${f}: ${before[f] ?? '—'} → ${updates[f] ?? '—'}`).join('; ')
    await logBookingAction(auth.admin, {
      bookingId: id,
      actorEmail: auth.session.user.email,
      action: isOnlyStatus ? 'status_changed' : 'edited',
      detail,
    })
  }

  return Response.json({ ok: true, booking: data })
}
