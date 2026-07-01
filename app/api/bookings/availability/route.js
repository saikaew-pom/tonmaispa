// GET /api/bookings/availability?date=YYYY-MM-DD&treatment_id=uuid&duration=60
// Returns available time slots for a given date, treatment and duration.

import { createSupabaseAdminClient } from '@/lib/supabase-admin'

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

  const admin = createSupabaseAdminClient()

  // Whole-spa blocked date check
  const { data: blocked } = await admin
    .from('blocked_dates')
    .select('id')
    .eq('date', date)
    .is('therapist_id', null)
    .limit(1)

  if (blocked?.length) return Response.json({ slots: [] })

  // Slot config: treatment-specific wins over global (treatment_id IS NULL)
  let cfg = null
  if (treatmentId) {
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
  // Hard fallback — spa is open 09:00-22:00 by default
  cfg ??= { first_slot: '09:00', last_slot: '22:00', slot_interval: 30, max_concurrent: 3, day_of_week: null }

  // Day-of-week gating (0=Sun in JS, same in PostgreSQL DOW)
  const dow = new Date(`${date}T12:00:00`).getDay()
  if (cfg.day_of_week && !cfg.day_of_week.includes(dow)) {
    return Response.json({ slots: [] })
  }

  // Generate start times — last slot must begin early enough to finish before closing
  const startMin  = timeToMin(cfg.first_slot)
  const endMin    = timeToMin(cfg.last_slot) - duration
  const interval  = cfg.slot_interval
  const maxConc   = cfg.max_concurrent

  const allSlots = []
  for (let m = startMin; m <= endMin; m += interval) allSlots.push(minToTime(m))
  if (!allSlots.length) return Response.json({ slots: [] })

  // Count confirmed/pending bookings per slot on this date
  const { data: bookings } = await admin
    .from('bookings')
    .select('time_slot')
    .eq('date', date)
    .in('status', ['pending', 'confirmed'])

  const counts = {}
  ;(bookings ?? []).forEach(b => {
    const t = b.time_slot.substring(0, 5)
    counts[t] = (counts[t] ?? 0) + 1
  })

  // Remove past slots when querying for today
  const now = new Date()
  const isToday = date === now.toISOString().split('T')[0]
  const bufferMin = now.getHours() * 60 + now.getMinutes() + 30

  const slots = allSlots
    .filter(s => !isToday || timeToMin(s) >= bufferMin)
    .map(s => ({
      time:      s,
      available: (counts[s] ?? 0) < maxConc,
      spotsLeft: Math.max(0, maxConc - (counts[s] ?? 0)),
    }))

  return Response.json({ slots })
}
