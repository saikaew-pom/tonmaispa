// Shared therapist/room availability logic — used by the public availability
// route and both booking-creation routes (public + admin) so they all agree
// on what's actually bookable. All time math works in minutes-since-midnight
// for simple interval overlap checks.

export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// [aStart,aEnd) overlaps [bStart,bEnd)?
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

export async function getQualifiedTherapistIds(admin, treatmentId) {
  const { data } = await admin
    .from('therapist_treatments')
    .select('therapist_id, therapists!inner(is_active)')
    .eq('treatment_id', treatmentId)
    .eq('therapists.is_active', true)
  return (data ?? []).map(r => r.therapist_id)
}

// How many therapists a treatment needs working simultaneously — 1 for
// almost everything, 2 for treatments like a couple's massage.
export async function getRequiredTherapistCount(admin, treatmentId) {
  const { data } = await admin.from('spa_treatments').select('therapists_required').eq('id', treatmentId).maybeSingle()
  return data?.therapists_required ?? 1
}

export async function getRoomCapacity(admin, date) {
  const dow = new Date(`${date}T12:00:00`).getDay()
  const { data } = await admin.from('room_capacity').select('room_count').eq('day_of_week', dow).maybeSingle()
  return data?.room_count ?? 0
}

// Slot configuration for a treatment: the treatment-specific rule wins,
// otherwise the global (treatment_id null) rule, otherwise safe defaults.
// max_concurrent is the staff-configurable cap on simultaneous bookings —
// enforced as an additional ceiling on top of physical room capacity.
export async function getSlotConfig(admin, treatmentId) {
  if (treatmentId) {
    const { data } = await admin.from('slot_settings').select('*')
      .eq('treatment_id', treatmentId).eq('is_active', true).maybeSingle()
    if (data) return data
  }
  const { data: globalCfg } = await admin.from('slot_settings').select('*')
    .is('treatment_id', null).eq('is_active', true).maybeSingle()
  return globalCfg ?? { first_slot: '09:00', last_slot: '22:00', slot_interval: 30, day_of_week: null, max_concurrent: null }
}

// Returns the subset of `therapistIds` who are working on `date` with a
// shift covering [startTime,endTime), not on a per-therapist blocked day,
// and not already booked (any treatment, as either primary or secondary
// therapist) overlapping that window.
export async function getFreeTherapistIds(admin, { therapistIds, date, startTime, endTime, excludeBookingId }) {
  if (!therapistIds.length) return []
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)

  let bookingsQuery = admin.from('bookings').select('id, therapist_id, secondary_therapist_id, time_slot, duration').eq('date', date).in('status', ['pending', 'confirmed'])
    .or(`therapist_id.in.(${therapistIds.join(',')}),secondary_therapist_id.in.(${therapistIds.join(',')})`)
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq('id', excludeBookingId)

  const [{ data: shifts }, { data: blocks }, { data: bookings }] = await Promise.all([
    admin.from('therapist_shifts').select('therapist_id, start_time, end_time, break_start, break_end').eq('date', date).in('therapist_id', therapistIds),
    admin.from('blocked_dates').select('therapist_id').eq('date', date).in('therapist_id', therapistIds),
    // A therapist can be committed to a booking either as the primary or
    // the secondary (couple's-style) therapist — both make them unavailable.
    bookingsQuery,
  ])

  const blockedSet = new Set((blocks ?? []).map(b => b.therapist_id))

  return therapistIds.filter(id => {
    if (blockedSet.has(id)) return false
    const shift = (shifts ?? []).find(s => s.therapist_id === id)
    if (!shift) return false // no shift on this date = not working
    if (startMin < timeToMin(shift.start_time.slice(0, 5)) || endMin > timeToMin(shift.end_time.slice(0, 5))) return false
    if (shift.break_start && shift.break_end) {
      const breakStart = timeToMin(shift.break_start.slice(0, 5))
      const breakEnd    = timeToMin(shift.break_end.slice(0, 5))
      if (overlaps(startMin, endMin, breakStart, breakEnd)) return false
    }

    const busy = (bookings ?? []).some(b => {
      if (b.therapist_id !== id && b.secondary_therapist_id !== id) return false
      const bStart = timeToMin(b.time_slot.slice(0, 5))
      return overlaps(startMin, endMin, bStart, bStart + b.duration)
    })
    return !busy
  })
}

// Rooms in use = bookings (any treatment/therapist) overlapping the window.
// `maxConcurrent` (from slot_settings) acts as an additional staff-set
// ceiling on simultaneous bookings, on top of physical room capacity.
export async function getAvailableRoomCount(admin, { date, startTime, endTime, excludeBookingId, maxConcurrent }) {
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)
  let bookingsQuery = admin.from('bookings').select('id, time_slot, duration').eq('date', date).in('status', ['pending', 'confirmed'])
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq('id', excludeBookingId)
  const [capacity, { data: bookings }] = await Promise.all([
    getRoomCapacity(admin, date),
    bookingsQuery,
  ])
  const inUse = (bookings ?? []).filter(b => {
    const bStart = timeToMin(b.time_slot.slice(0, 5))
    return overlaps(startMin, endMin, bStart, bStart + b.duration)
  }).length
  const effectiveCapacity = maxConcurrent ? Math.min(capacity, maxConcurrent) : capacity
  return Math.max(0, effectiveCapacity - inUse)
}

// Finds enough qualified, free therapists for a booking window — returns an
// array of therapist ids of length `therapists_required`, or null if not
// enough are free (e.g. a couple's treatment needs 2 but only 1 is free).
// `excludeBookingId` lets editing a booking's own date/time/treatment check
// capacity as if that booking's own current slot weren't already taken.
export async function findAvailableTherapists(admin, { treatmentId, date, startTime, endTime, excludeBookingId }) {
  const [qualified, required] = await Promise.all([
    getQualifiedTherapistIds(admin, treatmentId),
    getRequiredTherapistCount(admin, treatmentId),
  ])
  const free = await getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime, endTime, excludeBookingId })
  if (free.length < required) return null
  return free.slice(0, required)
}

// Convenience wrapper for the common single-therapist case.
export async function findAvailableTherapist(admin, args) {
  const found = await findAvailableTherapists(admin, args)
  return found?.[0] ?? null
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// The one true "can this booking actually happen?" check — the spa isn't
// closed that day, enough qualified therapists are free, AND a room is free
// for the whole window. Every write path (public site, admin dashboard,
// chatbot booking + reschedule) must go through this; a slot the availability
// display would show as unavailable must never be silently bookable. The
// whole-spa closure check exists here as well as in getAvailableSlots because
// staff can roster shifts on a day and *then* mark the spa closed — the
// contradictory data must not open a booking path the display already denies.
export async function checkSlotCapacity(admin, { treatmentId, date, startTime, endTime, excludeBookingId }) {
  const cfg = await getSlotConfig(admin, treatmentId)
  const [{ data: closure }, therapistIds, rooms] = await Promise.all([
    admin.from('blocked_dates').select('id').eq('date', date).is('therapist_id', null).limit(1),
    findAvailableTherapists(admin, { treatmentId, date, startTime, endTime, excludeBookingId }),
    getAvailableRoomCount(admin, { date, startTime, endTime, excludeBookingId, maxConcurrent: cfg.max_concurrent }),
  ])
  if (closure?.length)  return { ok: false, reason: 'closed', therapistIds: null }
  if (!therapistIds) return { ok: false, reason: 'no_therapist', therapistIds: null }
  if (rooms < 1)      return { ok: false, reason: 'no_room', therapistIds: null }
  return { ok: true, therapistIds }
}

// Maps errors raised by the enforce_booking_capacity DB trigger (migration
// 027) to a checkSlotCapacity-style failure. The trigger is the atomic
// backstop for the race window the JS pre-check can never close on its own:
// two simultaneous requests can both pass checkSlotCapacity, but only one
// survives the serialized in-transaction re-check. Every booking write path
// must run its insert/update error through this and treat a hit as a 409,
// exactly like a pre-check failure.
export function capacityErrorFromDb(error) {
  const msg = String(error?.message ?? '')
  if (msg.includes('THERAPIST_DOUBLE_BOOKED')) return { reason: 'no_therapist' }
  if (msg.includes('ROOM_CAPACITY_FULL'))      return { reason: 'no_room' }
  return null
}

// Full slot listing for a date/treatment/duration — shared by the public
// availability route and the chatbot's check_availability tool so they can
// never disagree about what's open. Returns { slots } or { slots: [] }.
export async function getAvailableSlots(admin, { date, treatmentId, duration, excludeBookingId }) {
  // Whole-spa closure
  const { data: blocked } = await admin
    .from('blocked_dates').select('id').eq('date', date).is('therapist_id', null).limit(1)
  if (blocked?.length) return { slots: [], closed: true }

  // Slot config: treatment-specific wins over global
  const cfg = await getSlotConfig(admin, treatmentId)

  const dow = new Date(`${date}T12:00:00`).getDay()
  if (cfg.day_of_week && !cfg.day_of_week.includes(dow)) return { slots: [] }

  const startMin = timeToMin(cfg.first_slot)
  const endMin   = timeToMin(cfg.last_slot) - duration
  const candidates = []
  for (let m = startMin; m <= endMin; m += cfg.slot_interval) candidates.push(minToTime(m))

  // Remove past slots when querying for today (30 min lead time)
  const now = new Date()
  const isToday = date === now.toISOString().split('T')[0]
  const bufferMin = now.getHours() * 60 + now.getMinutes() + 30
  const upcoming = candidates.filter(s => !isToday || timeToMin(s) >= bufferMin)
  if (!upcoming.length) return { slots: [] }

  const [qualified, required] = await Promise.all([
    getQualifiedTherapistIds(admin, treatmentId),
    getRequiredTherapistCount(admin, treatmentId),
  ])
  if (!qualified.length) return { slots: [] }

  const slots = await Promise.all(upcoming.map(async (time) => {
    const endTime = minToTime(timeToMin(time) + duration)
    const [freeTherapists, roomsAvailable] = await Promise.all([
      getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime: time, endTime, excludeBookingId }),
      getAvailableRoomCount(admin, { date, startTime: time, endTime, excludeBookingId, maxConcurrent: cfg.max_concurrent }),
    ])
    const spotsLeft = Math.min(Math.floor(freeTherapists.length / required), roomsAvailable)
    return { time, available: spotsLeft > 0, spotsLeft: Math.max(0, spotsLeft) }
  }))

  return { slots }
}

// "What can I actually book at this time?" — given a date and a specific
// start time, returns the active treatments that can be staffed then (a
// qualified therapist free for the treatment's own duration AND a room
// free). This is what lets the chatbot recommend treatments that fit both
// the guest's requested time AND who's actually working/skilled/free — the
// per-treatment check_availability tool can't answer that on its own.
export async function getBookableTreatmentsAt(admin, { date, startTime, durationPref }) {
  // Whole-spa closure
  const { data: blocked } = await admin
    .from('blocked_dates').select('id').eq('date', date).is('therapist_id', null).limit(1)
  if (blocked?.length) return { closed: true, treatments: [] }

  const { data: treatments } = await admin
    .from('spa_treatments')
    .select('id, name, category, prices, duration_options, therapists_required')
    .eq('is_active', true)
    .order('sort_order')

  const room = await getAvailableRoomCount(admin, { date, startTime, endTime: minToTime(timeToMin(startTime) + 30) })
  // If not even a single room is free at the start, nothing is bookable.
  if (room < 1) return { treatments: [] }

  const results = await Promise.all((treatments ?? []).map(async (t) => {
    const durations = (t.duration_options ?? []).length ? t.duration_options : [60]
    // Prefer the guest's requested duration if the treatment offers it,
    // otherwise report on the treatment's shortest option.
    const dur = (durationPref && durations.includes(durationPref)) ? durationPref : durations[0]
    const endTime = minToTime(timeToMin(startTime) + dur)

    const cap = await checkSlotCapacity(admin, { treatmentId: t.id, date, startTime, endTime })
    if (!cap.ok) return null
    return {
      name: t.name,
      category: t.category,
      duration: dur,
      price: t.prices?.[String(dur)] ?? null,
    }
  }))

  return { treatments: results.filter(Boolean) }
}
