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

// How long a booking actually ties up a therapist and a room.
//
// bookings.duration is the BILLED duration (the key into a treatment's
// duration_options/prices). Add-ons buy extra real minutes that were never
// billed as part of that option, so they live in addon_minutes. Every
// occupancy calculation must use the sum — anything that reads .duration
// alone will under-reserve and let the next guest overlap. (migration 032)
export function occupiedMinutes(booking) {
  return (booking?.duration ?? 0) + (booking?.addon_minutes ?? 0)
}

// The spa's wall-clock timezone. Date strings everywhere in this app (booking
// dates, the chatbot's "today", the availability grid) are Asia/Bangkok
// calendar dates. Production (Vercel) runs the Node process in UTC, so the
// "today" past-slot filter must derive the current date AND time-of-day in
// this zone explicitly — never from the server-local clock, which would put
// the cutoff 7 hours off and offer already-passed slots as bookable.
export const SPA_TZ = 'Asia/Bangkok'

// { date: 'YYYY-MM-DD', minutes: minutes-since-midnight } right now in SPA_TZ,
// independent of the server's TZ.
export function nowInSpaTz(at = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: SPA_TZ }).format(at)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SPA_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at)
  const h = Number(parts.find(p => p.type === 'hour').value) % 24 // guard midnight "24"
  const m = Number(parts.find(p => p.type === 'minute').value)
  return { date, minutes: h * 60 + m }
}

// True when the requested slot has already started in spa time — a past
// calendar date, or today at a time that's already gone. Guest-facing write
// paths (public POST, chat booking, chat reschedule) must refuse these: the
// availability DISPLAY already hides past slots, but display filtering is
// not enforcement, and a crafted request (or an AI-drafted date the model
// resolved into the past) would otherwise insert a booking for yesterday.
// Deliberately NOT wired into checkSlotCapacity: staff correcting a
// historical booking's time via the admin dashboard is legitimate.
export function isPastSlotInSpaTz(date, startTime, at) {
  const { date: today, minutes } = nowInSpaTz(at ? new Date(at) : undefined)
  if (date < today) return true // YYYY-MM-DD strings compare correctly
  if (date === today && startTime) return timeToMin(startTime) < minutes
  return false
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

// Turnaround / buffer minutes a therapist AND room need between two guests
// (cleanup, reset, rest). Read from the GLOBAL slot rule so it's a single
// spa-wide policy, live-editable on the dashboard with no deploy. Defaults to
// 0 — i.e. current back-to-back behaviour — so availability is unchanged until
// staff set a value, and it stays 0-safe even before the column migration runs
// (a missing column just reads as undefined → 0).
export async function getTurnaroundMin(admin) {
  // select('*') (not select('turnaround_min')) so this can't 400 before the
  // migration adds the column — a missing column is simply absent from the row.
  const { data } = await admin.from('slot_settings').select('*')
    .is('treatment_id', null).eq('is_active', true).maybeSingle()
  const n = Number(data?.turnaround_min)
  return Number.isFinite(n) && n > 0 ? n : 0
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
export async function getFreeTherapistIds(admin, { therapistIds, date, startTime, endTime, excludeBookingId, bufferMin = 0 }) {
  if (!therapistIds.length) return []
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)

  let bookingsQuery = admin.from('bookings').select('id, therapist_id, secondary_therapist_id, time_slot, duration, addon_minutes').eq('date', date).in('status', ['pending', 'confirmed'])
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
      // Expand both windows by the turnaround buffer so two of this
      // therapist's sessions are kept ≥ bufferMin apart. bufferMin=0 → the
      // exact back-to-back overlap check as before.
      return overlaps(startMin, endMin + bufferMin, bStart, bStart + occupiedMinutes(b) + bufferMin)
    })
    return !busy
  })
}

// Rooms in use = bookings (any treatment/therapist) overlapping the window.
// `maxConcurrent` (from slot_settings) acts as an additional staff-set
// ceiling on simultaneous bookings, on top of physical room capacity.
export async function getAvailableRoomCount(admin, { date, startTime, endTime, excludeBookingId, maxConcurrent, bufferMin = 0 }) {
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)
  let bookingsQuery = admin.from('bookings').select('id, time_slot, duration, addon_minutes').eq('date', date).in('status', ['pending', 'confirmed'])
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq('id', excludeBookingId)
  const [capacity, { data: bookings }] = await Promise.all([
    getRoomCapacity(admin, date),
    bookingsQuery,
  ])
  const inUse = (bookings ?? []).filter(b => {
    const bStart = timeToMin(b.time_slot.slice(0, 5))
    // A room needs the same turnaround (cleaning/reset) between guests.
    return overlaps(startMin, endMin + bufferMin, bStart, bStart + occupiedMinutes(b) + bufferMin)
  }).length
  const effectiveCapacity = maxConcurrent ? Math.min(capacity, maxConcurrent) : capacity
  return Math.max(0, effectiveCapacity - inUse)
}

// Finds enough qualified, free therapists for a booking window — returns an
// array of therapist ids of length `therapists_required`, or null if not
// enough are free (e.g. a couple's treatment needs 2 but only 1 is free).
// `excludeBookingId` lets editing a booking's own date/time/treatment check
// capacity as if that booking's own current slot weren't already taken.
export async function findAvailableTherapists(admin, { treatmentId, date, startTime, endTime, excludeBookingId, bufferMin = 0 }) {
  const [qualified, required] = await Promise.all([
    getQualifiedTherapistIds(admin, treatmentId),
    getRequiredTherapistCount(admin, treatmentId),
  ])
  const free = await getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime, endTime, excludeBookingId, bufferMin })
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
  const [cfg, bufferMin] = await Promise.all([
    getSlotConfig(admin, treatmentId),
    getTurnaroundMin(admin),
  ])
  const [{ data: closure }, therapistIds, rooms] = await Promise.all([
    admin.from('blocked_dates').select('id').eq('date', date).is('therapist_id', null).limit(1),
    findAvailableTherapists(admin, { treatmentId, date, startTime, endTime, excludeBookingId, bufferMin }),
    getAvailableRoomCount(admin, { date, startTime, endTime, excludeBookingId, maxConcurrent: cfg.max_concurrent, bufferMin }),
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
// `addonMinutes` extends the window the guest will actually occupy, so a slot
// is only offered if the FULL treatment+add-on span fits (inside opening
// hours, the therapist's shift, and around other bookings). Defaults to 0 →
// identical behaviour to before add-ons existed.
export async function getAvailableSlots(admin, { date, treatmentId, duration, addonMinutes = 0, excludeBookingId, asOf }) {
  const occupied = duration + addonMinutes
  // Whole-spa closure
  const { data: blocked } = await admin
    .from('blocked_dates').select('id').eq('date', date).is('therapist_id', null).limit(1)
  if (blocked?.length) return { slots: [], closed: true }

  // Slot config: treatment-specific wins over global. Turnaround buffer is a
  // single spa-wide policy read once and reused across every candidate slot.
  const [cfg, turnaroundMin] = await Promise.all([
    getSlotConfig(admin, treatmentId),
    getTurnaroundMin(admin),
  ])

  const dow = new Date(`${date}T12:00:00`).getDay()
  if (cfg.day_of_week && !cfg.day_of_week.includes(dow)) return { slots: [] }

  const startMin = timeToMin(cfg.first_slot)
  // Ceiling must leave room for the add-on tail too, or the last slot of the
  // day gets offered and then fails at insert.
  const endMin   = timeToMin(cfg.last_slot) - occupied
  const candidates = []
  for (let m = startMin; m <= endMin; m += cfg.slot_interval) candidates.push(minToTime(m))

  // Remove past slots when querying for today (30 min lead time). "Today" and
  // "now" are computed in the spa's timezone (see nowInSpaTz) so the cutoff is
  // correct regardless of the server's TZ — on a UTC server the old
  // server-local math offered every already-passed slot up to ~7h ago.
  const { date: todaySpa, minutes: nowMin } = nowInSpaTz(asOf ? new Date(asOf) : undefined)
  const isToday = date === todaySpa
  const bufferMin = nowMin + 30
  const upcoming = candidates.filter(s => !isToday || timeToMin(s) >= bufferMin)
  if (!upcoming.length) return { slots: [] }

  const [qualified, required] = await Promise.all([
    getQualifiedTherapistIds(admin, treatmentId),
    getRequiredTherapistCount(admin, treatmentId),
  ])
  if (!qualified.length) return { slots: [] }

  const slots = await Promise.all(upcoming.map(async (time) => {
    const endTime = minToTime(timeToMin(time) + occupied)
    const [freeTherapists, roomsAvailable] = await Promise.all([
      getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime: time, endTime, excludeBookingId, bufferMin: turnaroundMin }),
      getAvailableRoomCount(admin, { date, startTime: time, endTime, excludeBookingId, maxConcurrent: cfg.max_concurrent, bufferMin: turnaroundMin }),
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

// Human-readable reason for why an upcoming booking has lost therapist cover.
export const COVERAGE_REASON_LABELS = {
  unassigned:    'No therapist assigned',
  inactive:      'Assigned therapist is deactivated',
  no_shift:      'Assigned therapist is not rostered that day',
  outside_shift: 'Booking falls outside the therapist’s shift',
  on_break:      'Booking overlaps the therapist’s break',
  blocked:       'Assigned therapist is blocked that day',
  spa_closed:    'Spa is now marked closed that day',
}

// Annotate a list of bookings with a coverage problem, if any. An "orphaned"
// booking is an upcoming pending/confirmed booking whose assigned therapist
// is no longer actually working its slot — the classic sick-day case where a
// shift is shortened or deleted after the booking was made, leaving a guest
// with no one to serve them and nothing surfacing it. Returns a
// Map<booking.id, reason> holding ONLY the problem bookings (covered ones are
// absent). Reads shift/block/therapist data for just the dates + therapists
// present in the upcoming set, so it's one small batch regardless of history.
export async function annotateBookingCoverage(admin, bookings, { asOf } = {}) {
  const { date: todaySpa } = nowInSpaTz(asOf ? new Date(asOf) : undefined)
  const upcoming = (bookings ?? []).filter(b =>
    b?.date >= todaySpa && ['pending', 'confirmed'].includes(b?.status))
  const result = new Map()
  if (!upcoming.length) return result

  const dates = [...new Set(upcoming.map(b => b.date))]
  const therapistIds = [...new Set(upcoming.flatMap(b =>
    [b.therapist_id, b.secondary_therapist_id].filter(Boolean)))]

  const [{ data: shifts }, { data: blocks }, { data: staff }] = await Promise.all([
    therapistIds.length
      ? admin.from('therapist_shifts')
          .select('therapist_id, date, start_time, end_time, break_start, break_end')
          .in('date', dates).in('therapist_id', therapistIds)
      : Promise.resolve({ data: [] }),
    admin.from('blocked_dates').select('therapist_id, date').in('date', dates),
    therapistIds.length
      ? admin.from('therapists').select('id, is_active').in('id', therapistIds)
      : Promise.resolve({ data: [] }),
  ])

  const shiftBy = new Map((shifts ?? []).map(s => [`${s.therapist_id}|${s.date}`, s]))
  const blockedSet = new Set((blocks ?? []).filter(b => b.therapist_id).map(b => `${b.therapist_id}|${b.date}`))
  const closedDates = new Set((blocks ?? []).filter(b => !b.therapist_id).map(b => b.date))
  const inactive = new Set((staff ?? []).filter(t => t.is_active === false).map(t => t.id))

  // Why is therapist `tId` not covering booking `b`? null = covered.
  const reasonFor = (tId, b) => {
    if (inactive.has(tId)) return 'inactive'
    const shift = shiftBy.get(`${tId}|${b.date}`)
    if (!shift) return 'no_shift'
    const bStart = timeToMin(b.time_slot.slice(0, 5))
    // Add-on minutes count: a 60-min massage + 15-min add-on really can spill
    // past the therapist's shift end or into their break.
    const bEnd = bStart + occupiedMinutes(b)
    if (bStart < timeToMin(shift.start_time.slice(0, 5)) || bEnd > timeToMin(shift.end_time.slice(0, 5))) return 'outside_shift'
    if (shift.break_start && shift.break_end &&
        overlaps(bStart, bEnd, timeToMin(shift.break_start.slice(0, 5)), timeToMin(shift.break_end.slice(0, 5)))) return 'on_break'
    if (blockedSet.has(`${tId}|${b.date}`)) return 'blocked'
    return null
  }

  for (const b of upcoming) {
    if (closedDates.has(b.date)) { result.set(b.id, 'spa_closed'); continue }
    if (!b.therapist_id) { result.set(b.id, 'unassigned'); continue }
    // Every assigned therapist (primary + any secondary) must be covered.
    const reason = reasonFor(b.therapist_id, b) ??
      (b.secondary_therapist_id ? reasonFor(b.secondary_therapist_id, b) : null)
    if (reason) result.set(b.id, reason)
  }
  return result
}
