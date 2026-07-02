// GET /api/bookings/availability?date=YYYY-MM-DD&treatment_id=uuid&duration=60
// Returns available time slots for a given date, treatment and duration.
// A slot is available only if at least one qualified therapist is working
// and free at that time AND a treatment room is free — see lib/scheduling.js.

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getQualifiedTherapistIds, getFreeTherapistIds, getAvailableRoomCount } from '@/lib/scheduling'

export const dynamic = 'force-dynamic'

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const date        = searchParams.get('date')         // YYYY-MM-DD
  const treatmentId = searchParams.get('treatment_id') // uuid | ''
  const duration    = parseInt(searchParams.get('duration') ?? '60', 10)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (!treatmentId) {
    return Response.json({ error: 'treatment_id is required' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // Whole-spa blocked date check
  const { data: blocked } = await admin
    .from('blocked_dates')
    .select('id')
    .eq('date', date)
    .is('therapist_id', null)
    .limit(1)

  if (blocked?.length) return Response.json({ slots: [] })

  // Slot config: treatment-specific wins over global (treatment_id IS NULL).
  // This still controls slot *granularity* (interval) and the outer time
  // window candidates are generated within — actual bookability per slot is
  // now decided by therapist shift + room capacity below.
  let cfg = null
  {
    const { data } = await admin
      .from('slot_settings')
      .select('*')
      .eq('treatment_id', treatmentId)
      .eq('is_active', true)
      .maybeSingle()
    cfg = data
  }
  if (!cfg) {
    const { data } = await admin
      .from('slot_settings')
      .select('*')
      .is('treatment_id', null)
      .eq('is_active', true)
      .maybeSingle()
    cfg = data
  }
  cfg ??= { first_slot: '09:00', last_slot: '22:00', slot_interval: 30, day_of_week: null }

  // Day-of-week gating (0=Sun in JS, same in PostgreSQL DOW)
  const dow = new Date(`${date}T12:00:00`).getDay()
  if (cfg.day_of_week && !cfg.day_of_week.includes(dow)) {
    return Response.json({ slots: [] })
  }

  // Generate candidate start times — last slot must begin early enough to
  // finish before closing.
  const startMin = timeToMin(cfg.first_slot)
  const endMin   = timeToMin(cfg.last_slot) - duration
  const interval = cfg.slot_interval

  const candidates = []
  for (let m = startMin; m <= endMin; m += interval) candidates.push(minToTime(m))
  if (!candidates.length) return Response.json({ slots: [] })

  // Remove past slots when querying for today
  const now = new Date()
  const isToday = date === now.toISOString().split('T')[0]
  const bufferMin = now.getHours() * 60 + now.getMinutes() + 30
  const upcoming = candidates.filter(s => !isToday || timeToMin(s) >= bufferMin)
  if (!upcoming.length) return Response.json({ slots: [] })

  const qualified = await getQualifiedTherapistIds(admin, treatmentId)
  if (!qualified.length) return Response.json({ slots: [] }) // no one can perform this treatment

  const slots = await Promise.all(upcoming.map(async (time) => {
    const endTime = minToTime(timeToMin(time) + duration)
    const [freeTherapists, roomsAvailable] = await Promise.all([
      getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime: time, endTime }),
      getAvailableRoomCount(admin, { date, startTime: time, endTime }),
    ])
    const spotsLeft = Math.min(freeTherapists.length, roomsAvailable)
    return { time, available: spotsLeft > 0, spotsLeft: Math.max(0, spotsLeft) }
  }))

  return Response.json({ slots })
}
