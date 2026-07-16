// GET /api/bookings/availability?date=YYYY-MM-DD&treatment_id=uuid&duration=60
// Returns available time slots for a given date, treatment and duration.
// A slot is available only if at least one qualified therapist is working
// and free at that time AND a treatment room is free. The actual logic lives
// in lib/scheduling.js (getAvailableSlots) and is shared with the chatbot's
// check_availability tool so the two can never disagree.

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getAvailableSlots } from '@/lib/scheduling'
import { resolveAddons } from '@/lib/booking-addons'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const date        = searchParams.get('date')         // YYYY-MM-DD
  const treatmentId = searchParams.get('treatment_id') // uuid | ''
  const duration    = parseInt(searchParams.get('duration') ?? '60', 10)
  // Optional CSV of add-on ids: they extend the window the guest occupies, so
  // the grid must be computed against the FULL span — otherwise we offer a
  // slot that the booking POST then rejects.
  const addonIds    = (searchParams.get('addon_ids') ?? '').split(',').filter(Boolean)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (!treatmentId) {
    return Response.json({ error: 'treatment_id is required' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const addons = await resolveAddons(admin, addonIds)
  if (!addons.ok) return Response.json({ error: addons.error }, { status: 400 })

  const { slots } = await getAvailableSlots(admin, {
    date, treatmentId, duration, addonMinutes: addons.minutes,
  })
  return Response.json({ slots, addonMinutes: addons.minutes })
}
