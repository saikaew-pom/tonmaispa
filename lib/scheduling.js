// Shared therapist/room availability logic — used by the public availability
// route and both booking-creation routes (public + admin) so they all agree
// on what's actually bookable. All time math works in minutes-since-midnight
// for simple interval overlap checks.

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// [aStart,aEnd) overlaps [bStart,bEnd)?
function overlaps(aStart, aEnd, bStart, bEnd) {
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

export async function getRoomCapacity(admin, date) {
  const dow = new Date(`${date}T12:00:00`).getDay()
  const { data } = await admin.from('room_capacity').select('room_count').eq('day_of_week', dow).maybeSingle()
  return data?.room_count ?? 0
}

// Returns the subset of `therapistIds` who are working on `date` with a
// shift covering [startTime,endTime), not on a per-therapist blocked day,
// and not already booked (any treatment) overlapping that window.
export async function getFreeTherapistIds(admin, { therapistIds, date, startTime, endTime }) {
  if (!therapistIds.length) return []
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)

  const [{ data: shifts }, { data: blocks }, { data: bookings }] = await Promise.all([
    admin.from('therapist_shifts').select('therapist_id, start_time, end_time').eq('date', date).in('therapist_id', therapistIds),
    admin.from('blocked_dates').select('therapist_id').eq('date', date).in('therapist_id', therapistIds),
    admin.from('bookings').select('therapist_id, time_slot, duration').eq('date', date).in('therapist_id', therapistIds).in('status', ['pending', 'confirmed']),
  ])

  const blockedSet = new Set((blocks ?? []).map(b => b.therapist_id))

  return therapistIds.filter(id => {
    if (blockedSet.has(id)) return false
    const shift = (shifts ?? []).find(s => s.therapist_id === id)
    if (!shift) return false // no shift on this date = not working
    if (startMin < timeToMin(shift.start_time.slice(0, 5)) || endMin > timeToMin(shift.end_time.slice(0, 5))) return false

    const busy = (bookings ?? []).some(b => {
      if (b.therapist_id !== id) return false
      const bStart = timeToMin(b.time_slot.slice(0, 5))
      return overlaps(startMin, endMin, bStart, bStart + b.duration)
    })
    return !busy
  })
}

// Rooms in use = bookings (any treatment/therapist) overlapping the window.
export async function getAvailableRoomCount(admin, { date, startTime, endTime }) {
  const startMin = timeToMin(startTime)
  const endMin   = timeToMin(endTime)
  const [capacity, { data: bookings }] = await Promise.all([
    getRoomCapacity(admin, date),
    admin.from('bookings').select('time_slot, duration').eq('date', date).in('status', ['pending', 'confirmed']),
  ])
  const inUse = (bookings ?? []).filter(b => {
    const bStart = timeToMin(b.time_slot.slice(0, 5))
    return overlaps(startMin, endMin, bStart, bStart + b.duration)
  }).length
  return Math.max(0, capacity - inUse)
}

// Finds one qualified, free therapist for a booking window, or null.
export async function findAvailableTherapist(admin, { treatmentId, date, startTime, endTime }) {
  const qualified = await getQualifiedTherapistIds(admin, treatmentId)
  const free = await getFreeTherapistIds(admin, { therapistIds: qualified, date, startTime, endTime })
  return free[0] ?? null
}
