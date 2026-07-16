import { requireAdmin } from '@/lib/require-admin'
import { getFreeTherapistIds, getQualifiedTherapistIds } from '@/lib/scheduling'

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// GET /api/admin/bookings/[id]/therapist-check?therapist_id=…
// Real-time "can this therapist take this booking?" answer for the assign
// confirmation popup: qualified for the treatment, on shift for the whole
// window, and not booked on anything overlapping. The PATCH route re-validates
// on save — this endpoint only exists so staff see the verdict BEFORE
// committing, with a reason they can act on.
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const therapistId = new URL(req.url).searchParams.get('therapist_id')
  if (!therapistId) return Response.json({ error: 'therapist_id is required' }, { status: 400 })

  const { data: booking } = await auth.admin
    .from('bookings')
    .select('treatment_id, date, time_slot, duration, addon_minutes')
    .eq('id', id)
    .maybeSingle()
  if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })

  const startTime = booking.time_slot.slice(0, 5)
  // Add-ons occupy real therapist minutes past the billed duration, so the
  // verdict staff see here must span them — otherwise this popup says
  // "available" for a therapist the PATCH route (and the DB trigger) will
  // then refuse.
  const endTime = addMinutes(startTime, booking.duration + (booking.addon_minutes ?? 0))

  const qualifiedIds = await getQualifiedTherapistIds(auth.admin, booking.treatment_id)
  if (!qualifiedIds.includes(therapistId)) {
    return Response.json({ available: false, reason: 'not_qualified', message: 'This therapist is not marked as qualified for this treatment.' })
  }

  const freeIds = await getFreeTherapistIds(auth.admin, {
    therapistIds: [therapistId],
    date: booking.date,
    startTime,
    endTime,
    excludeBookingId: id,
  })
  if (!freeIds.includes(therapistId)) {
    return Response.json({ available: false, reason: 'busy_or_off_shift', message: 'This therapist is off shift or already booked during this time.' })
  }

  return Response.json({ available: true, message: 'Available: qualified, on shift, and free for this time.' })
}
