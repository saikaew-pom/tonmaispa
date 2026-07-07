// Robust E2E test of the booking engine ↔ availability ↔ roster linkage,
// including the AI chat layer (draft/confirm/reschedule). Runs against the
// real DB with isolated fixtures on far-future dates (2027-03-*) so nothing
// collides with real bookings; everything created is deleted by exact ID.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const PROJECT_ROOT = '/Users/psk/Documents/vibe-coding-projects/tonmai-spa/tonmai-next'
const envText = fs.readFileSync(path.join(PROJECT_ROOT, '.env.local'), 'utf8')
for (const line of envText.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  const h = v.indexOf(' #'); if (h !== -1) v = v.slice(0, h).trim()
  v = v.replace(/^["']|["']$/g, '')
  if (!process.env[k]) process.env[k] = v
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const {
  getFreeTherapistIds, checkSlotCapacity, getAvailableSlots, getBookableTreatmentsAt, capacityErrorFromDb,
} = await import('../lib/scheduling.js')
const {
  prepareBookingDraft, confirmBookingDraft,
  getRescheduleAvailability, prepareRescheduleDraft, confirmRescheduleDraft,
} = await import('../lib/chat-booking.js')

// ── Test bookkeeping ─────────────────────────────────────────────
let pass = 0, fail = 0
const failures = []
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(name); console.log(`  ✗ ${name} ${detail ? '— ' + detail : ''}`) }
}
const cleanup = { bookings: [], therapists: [], shifts: [], quals: [], blocks: [], sessions: [], customers: [] }

// ── Fixture dates (far future — no real data there) ──────────────
const D_MAIN  = '2027-03-10' // Wednesday — main roster day
const D_CLOSED = '2027-03-11' // whole-spa closure
const D_BLOCK  = '2027-03-12' // per-therapist block

// Real treatments (read-only)
const { data: single } = await admin.from('spa_treatments')
  .select('id, name, duration_options, therapists_required').eq('id', '2058b911-5063-44b5-a9ed-e766fb7750d9').maybeSingle()
const { data: couples } = await admin.from('spa_treatments')
  .select('id, name, duration_options, therapists_required').eq('therapists_required', 2).limit(1).maybeSingle()
console.log(`Fixtures: single="${single?.name}" (req ${single?.therapists_required}), couples="${couples?.name}" (req ${couples?.therapists_required})`)

// Sanity: no real bookings/shifts on fixture dates
const { data: preExisting } = await admin.from('bookings').select('id').in('date', [D_MAIN, D_CLOSED, D_BLOCK])
const { data: preShifts } = await admin.from('therapist_shifts').select('id').in('date', [D_MAIN, D_CLOSED, D_BLOCK])
if (preExisting?.length || preShifts?.length) {
  console.error('ABORT: fixture dates are not clean —', preExisting?.length, 'bookings,', preShifts?.length, 'shifts already exist there')
  process.exit(1)
}

// ── Build fixtures ───────────────────────────────────────────────
async function makeTherapist(name) {
  const { data, error } = await admin.from('therapists').insert({ name, is_active: true, sort_order: 999 }).select('id').single()
  if (error) throw new Error('therapist insert: ' + error.message)
  cleanup.therapists.push(data.id)
  return data.id
}
const T1 = await makeTherapist('ZZTEST Alpha')
const T2 = await makeTherapist('ZZTEST Beta')
const T3 = await makeTherapist('ZZTEST Gamma') // deliberately no shift on D_MAIN

for (const tid of [T1, T2, T3]) {
  for (const trt of [single.id, couples.id]) {
    const { error } = await admin.from('therapist_treatments').insert({ therapist_id: tid, treatment_id: trt })
    if (error) throw new Error('qual insert: ' + error.message)
    cleanup.quals.push({ therapist_id: tid, treatment_id: trt })
  }
}

async function makeShift(tid, date, start, end, breakStart = null, breakEnd = null) {
  const { data, error } = await admin.from('therapist_shifts')
    .insert({ therapist_id: tid, date, start_time: start, end_time: end, break_start: breakStart, break_end: breakEnd })
    .select('id').single()
  if (error) throw new Error('shift insert: ' + error.message)
  cleanup.shifts.push(data.id)
}
// D_MAIN roster: T1 10:00–20:00 (break 12–13), T2 10:00–14:00, T3 off
await makeShift(T1, D_MAIN, '10:00', '20:00', '12:00', '13:00')
await makeShift(T2, D_MAIN, '10:00', '14:00')
// D_BLOCK roster: T1 + T2 both 10:00–20:00, but T1 personally blocked
await makeShift(T1, D_BLOCK, '10:00', '20:00')
await makeShift(T2, D_BLOCK, '10:00', '20:00')
// D_CLOSED roster: T1 on shift (contradictory data — tests closure precedence)
await makeShift(T1, D_CLOSED, '10:00', '20:00')

const { data: blockRow } = await admin.from('blocked_dates').insert({ date: D_BLOCK, therapist_id: T1 }).select('id').single()
cleanup.blocks.push(blockRow.id)
const { data: closureRow } = await admin.from('blocked_dates').insert({ date: D_CLOSED, therapist_id: null }).select('id').single()
cleanup.blocks.push(closureRow.id)

const ALL = [T1, T2, T3]
const cap = (args) => checkSlotCapacity(admin, { treatmentId: single.id, date: D_MAIN, ...args })

// ══ A. Roster & shift linkage ════════════════════════════════════
console.log('\n═ A. Roster & shift linkage')
let free = await getFreeTherapistIds(admin, { therapistIds: ALL, date: D_MAIN, startTime: '10:00', endTime: '11:00' })
check('A1 both rostered therapists free at 10:00, unrostered T3 excluded',
  free.includes(T1) && free.includes(T2) && !free.includes(T3), JSON.stringify(free))

free = await getFreeTherapistIds(admin, { therapistIds: ALL, date: D_MAIN, startTime: '09:00', endTime: '10:00' })
check('A2 nobody free before shift start (09:00)', free.length === 0, JSON.stringify(free))

free = await getFreeTherapistIds(admin, { therapistIds: ALL, date: D_MAIN, startTime: '19:00', endTime: '20:00' })
check('A3 booking ending exactly at shift end (19:00–20:00) allowed for T1', free.length === 1 && free[0] === T1)

free = await getFreeTherapistIds(admin, { therapistIds: ALL, date: D_MAIN, startTime: '19:30', endTime: '20:30' })
check('A4 booking spilling past shift end rejected', free.length === 0)

free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '12:00', endTime: '13:00' })
check('A5 T1 not free during break (12:00–13:00)', free.length === 0)
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '12:30', endTime: '13:30' })
check('A6 partial break overlap (12:30–13:30) rejected', free.length === 0)
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '13:00', endTime: '14:00' })
check('A7 booking starting exactly at break end (13:00) allowed', free.length === 1)

free = await getFreeTherapistIds(admin, { therapistIds: ALL, date: D_BLOCK, startTime: '11:00', endTime: '12:00' })
check('A8 per-therapist blocked date excludes T1, keeps T2', free.length === 1 && free[0] === T2, JSON.stringify(free))

// ══ B. Booking overlap linkage ═══════════════════════════════════
console.log('\n═ B. Existing-booking overlap')
async function makeBooking(fields) {
  const { data, error } = await admin.from('bookings').insert({
    guest_name: 'ZZTEST Guest', guest_phone: '+66900000001',
    treatment_id: single.id, date: D_MAIN, duration: 60, status: 'confirmed', source: 'walk_in',
    ...fields,
  }).select('id').single()
  if (error) throw new Error('booking insert: ' + error.message)
  cleanup.bookings.push(data.id)
  return data.id
}

const b1 = await makeBooking({ therapist_id: T1, time_slot: '14:00' }) // T1 busy 14:00–15:00
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '14:00', endTime: '15:00' })
check('B1 confirmed booking blocks T1 in its window', free.length === 0)
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '14:30', endTime: '15:30' })
check('B2 partial overlap (14:30) blocked', free.length === 0)
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '15:00', endTime: '16:00' })
check('B3 back-to-back booking (15:00 start) allowed', free.length === 1)

const bCancelled = await makeBooking({ therapist_id: T1, time_slot: '16:00', status: 'cancelled' })
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '16:00', endTime: '17:00' })
check('B4 cancelled booking does NOT block', free.length === 1)

const bSecondary = await makeBooking({ therapist_id: T3, secondary_therapist_id: T1, time_slot: '17:00' })
free = await getFreeTherapistIds(admin, { therapistIds: [T1], date: D_MAIN, startTime: '17:00', endTime: '18:00' })
check('B5 secondary_therapist assignment blocks T1 too', free.length === 0)

const r1 = await cap({ startTime: '14:00', endTime: '15:00' })
check('B6 checkSlotCapacity at 14:00 still ok via T2 (on shift till 14:00? NO — expect no_therapist)',
  r1.ok === false && r1.reason === 'no_therapist', JSON.stringify(r1))

// ══ C. Multi-therapist (couples) treatment ═══════════════════════
console.log('\n═ C. Couples treatment (therapists_required = 2)')
let c = await checkSlotCapacity(admin, { treatmentId: couples.id, date: D_MAIN, startTime: '10:00', endTime: '11:00' })
check('C1 couples booking ok when 2 qualified free (assigns both)',
  c.ok && c.therapistIds.length === 2 && c.therapistIds.includes(T1) && c.therapistIds.includes(T2), JSON.stringify(c))
c = await checkSlotCapacity(admin, { treatmentId: couples.id, date: D_MAIN, startTime: '18:00', endTime: '19:00' })
check('C2 couples booking rejected when only 1 free (T2 off after 14:00)', c.ok === false && c.reason === 'no_therapist')

// ══ D. Concurrency caps (rooms + max_concurrent) ═════════════════
console.log('\n═ D. Concurrency caps (rooms + max_concurrent)')
const { data: capRow } = await admin.from('room_capacity').select('room_count').eq('day_of_week', 3).maybeSingle() // Wed
const roomCount = capRow?.room_count ?? 0
const { data: globalCfg } = await admin.from('slot_settings').select('max_concurrent').is('treatment_id', null).eq('is_active', true).maybeSingle()
const maxConcurrent = globalCfg?.max_concurrent ?? null
const effectiveCap = maxConcurrent ? Math.min(roomCount, maxConcurrent) : roomCount
console.log(`  (rooms=${roomCount}, max_concurrent=${maxConcurrent} → effective cap=${effectiveCap})`)
const dummies = []
for (let i = 0; i < effectiveCap; i++) {
  dummies.push(await makeBooking({ therapist_id: null, time_slot: '11:00', status: 'pending' }))
}
let d = await cap({ startTime: '11:00', endTime: '12:00' })
check(`D1 ${effectiveCap} overlapping bookings exhaust the effective cap → no_room`, d.ok === false && d.reason === 'no_room', JSON.stringify(d))
d = await cap({ startTime: '11:00', endTime: '12:00', excludeBookingId: dummies[0] })
check('D2 excludeBookingId frees its own spot (edit path)', d.ok === true, JSON.stringify(d))
d = await cap({ startTime: '10:00', endTime: '11:00' })
check('D3 adjacent window (10:00–11:00) unaffected by 11:00 full block', d.ok === true)
if (maxConcurrent && maxConcurrent < roomCount) {
  // max_concurrent is the binding constraint app-side; physical rooms still
  // have headroom, so a direct insert (trigger-level) must still succeed.
  const extra = await makeBooking({ therapist_id: null, time_slot: '11:00', status: 'pending' })
  check('D4 max_concurrent binds the app layer while physical rooms retain trigger headroom', !!extra)
} else {
  console.log('  (D4 skipped — max_concurrent does not undercut room capacity in current config)')
}

// ══ E. Whole-spa closure ═════════════════════════════════════════
console.log('\n═ E. Whole-spa closure')
const closedSlots = await getAvailableSlots(admin, { date: D_CLOSED, treatmentId: single.id, duration: 60 })
check('E1 getAvailableSlots reports closed', closedSlots.closed === true && closedSlots.slots.length === 0)
const closedCap = await checkSlotCapacity(admin, { treatmentId: single.id, date: D_CLOSED, startTime: '11:00', endTime: '12:00' })
check('E2 [known-gap probe] checkSlotCapacity also refuses a spa-closed date', closedCap.ok === false,
  `capacity said ok=${closedCap.ok} — closure is only enforced in getAvailableSlots`)
const closedRec = await getBookableTreatmentsAt(admin, { date: D_CLOSED, startTime: '11:00' })
check('E3 chatbot recommend_treatments respects closure', closedRec.closed === true && closedRec.treatments.length === 0)

// ══ F. Slot listing integration ══════════════════════════════════
console.log('\n═ F. getAvailableSlots integration (D_MAIN, 60 min)')
const { slots } = await getAvailableSlots(admin, { date: D_MAIN, treatmentId: single.id, duration: 60 })
const at = (t) => slots.find(s => s.time === t)
check('F1 slot grid starts at config first_slot (09:00 candidate exists)', !!at('09:00'))
check('F2 09:00 unavailable (before roster)', at('09:00')?.available === false)
check('F3 10:00 available with spotsLeft=2 (T1+T2, rooms plenty)', at('10:00')?.available === true && at('10:00')?.spotsLeft === 2, JSON.stringify(at('10:00')))
check('F4 11:00 unavailable (rooms exhausted)', at('11:00')?.available === false)
check('F5 12:00 spotsLeft=1 (T1 on break, T2 free)', at('12:00')?.spotsLeft === 1, JSON.stringify(at('12:00')))
check('F6 14:00 unavailable (T1 booked, T2 off-shift)', at('14:00')?.available === false)
check('F7 19:00 available via T1 (ends at shift end)', at('19:00')?.available === true && at('19:00')?.spotsLeft === 1)
check('F8 last candidate respects last_slot − duration (21:00 exists, 21:30 does not)', !!at('21:00') && !at('21:30'))

// ══ G. AI chat layer — draft / confirm ═══════════════════════════
console.log('\n═ G. AI chat draft → confirm')
const S1 = randomUUID(); cleanup.sessions.push(S1)
const draft1 = await prepareBookingDraft(admin, S1, {
  guest_name: 'ZZTEST Chat Guest', treatment_id: single.id, date: D_MAIN, time_slot: '10:00', duration: 60,
})
check('G1 prepare_booking succeeds on open slot (no phone/email needed)', draft1.ok === true && draft1.draft_ready === true, JSON.stringify(draft1).slice(0, 120))

const S2 = randomUUID(); cleanup.sessions.push(S2)
const draftFull = await prepareBookingDraft(admin, S2, {
  guest_name: 'ZZTEST Chat Guest2', treatment_id: single.id, date: D_MAIN, time_slot: '11:00', duration: 60,
})
check('G2 prepare_booking on room-full slot refused with alternatives',
  draftFull.ok === false && Array.isArray(draftFull.nearest_open_times) && !draftFull.nearest_open_times.includes('11:00') && draftFull.nearest_open_times.length > 0,
  JSON.stringify(draftFull).slice(0, 160))

const badContact = await confirmBookingDraft(admin, {
  sessionId: S1, token: draft1.token, sendNotifications: false,
  guest_name: 'ZZTEST Chat Guest', guest_phone: '0812345678', guest_email: 'x@example.com',
})
check('G3 confirm rejects phone without country code', badContact.ok === false && badContact.status === 400)

const wrongToken = await confirmBookingDraft(admin, {
  sessionId: S1, token: randomUUID(), sendNotifications: false,
  guest_name: 'ZZTEST Chat Guest', guest_phone: '+66900000002', guest_email: 'zztest@example.com',
})
check('G4 confirm rejects wrong token', wrongToken.ok === false && wrongToken.status === 404)

const confirmed = await confirmBookingDraft(admin, {
  sessionId: S1, token: draft1.token, sendNotifications: false,
  guest_name: 'ZZTEST Chat Guest', guest_phone: '+66900000002', guest_email: 'zztest@example.com',
})
if (confirmed.booking_id) cleanup.bookings.push(confirmed.booking_id)
check('G5 confirm inserts pending booking', confirmed.ok === true && confirmed.status === 'pending', JSON.stringify(confirmed).slice(0, 140))

const { data: chatBooking } = await admin.from('bookings')
  .select('therapist_id, status, guest_phone, chat_session_id').eq('id', confirmed.booking_id).maybeSingle()
check('G6 auto-assigned therapist is one of the rostered pair', [T1, T2].includes(chatBooking?.therapist_id))
check('G7 booking row: pending, E.164 phone, session linked',
  chatBooking?.status === 'pending' && chatBooking?.guest_phone === '+66900000002' && chatBooking?.chat_session_id === S1)

free = await getFreeTherapistIds(admin, { therapistIds: [chatBooking.therapist_id], date: D_MAIN, startTime: '10:00', endTime: '11:00' })
check('G8 chat-created booking immediately consumes therapist availability', free.length === 0)

// ══ H. AI chat layer — reschedule ════════════════════════════════
console.log('\n═ H. AI chat reschedule (linked to same roster)')
await admin.from('bookings').update({ guest_email: null }).eq('id', confirmed.booking_id) // suppress reschedule email
const avail = await getRescheduleAvailability(admin, S1, { booking_id: confirmed.booking_id, date: D_MAIN })
check('H1 reschedule availability lists open times excluding room-full 11:00',
  avail.ok === true && avail.open_times.includes('15:00') && !avail.open_times.includes('11:00'), JSON.stringify(avail.open_times ?? []).slice(0, 120))
check('H2 reschedule availability includes own current slot (excludeBookingId works)', avail.open_times.includes('10:00'))

const badRes = await prepareRescheduleDraft(admin, S1, { booking_id: confirmed.booking_id, date: D_MAIN, time_slot: '11:00' })
check('H3 reschedule to room-full slot refused with alternatives', badRes.ok === false && Array.isArray(badRes.nearest_open_times))

const resDraft = await prepareRescheduleDraft(admin, S1, { booking_id: confirmed.booking_id, date: D_MAIN, time_slot: '15:00' })
check('H4 reschedule draft prepared for open 15:00', resDraft.ok === true && resDraft.reschedule_ready === true)

const resConfirm = await confirmRescheduleDraft(admin, { sessionId: S1, token: resDraft.token, settings: {} })
check('H5 reschedule confirm succeeds', resConfirm.ok === true, JSON.stringify(resConfirm).slice(0, 140))

const { data: moved } = await admin.from('bookings').select('date, time_slot, status, therapist_id').eq('id', confirmed.booking_id).maybeSingle()
check('H6 booking moved to 15:00, back to pending, therapist reassigned to T1 (only one on shift)',
  moved?.time_slot?.startsWith('15:00') && moved?.status === 'pending' && moved?.therapist_id === T1, JSON.stringify(moved))

free = await getFreeTherapistIds(admin, { therapistIds: [T1, T2], date: D_MAIN, startTime: '10:00', endTime: '11:00' })
check('H7 old 10:00 slot freed after reschedule', free.length === 2)

// ══ I. Atomic capacity trigger (migration 027) ═══════════════════
console.log('\n═ I. Atomic capacity trigger — races, backstop, overbook bypass')
// 18:00–19:00: only T1 free (T2 off shift). Two capacity+insert pairs fired
// in parallel simulate two public POSTs hitting the API at the same instant —
// both pass the JS pre-check, but the DB trigger must let exactly one through.
async function simulatePublicBook(guestName) {
  const capRes = await checkSlotCapacity(admin, { treatmentId: single.id, date: D_MAIN, startTime: '18:00', endTime: '19:00' })
  if (!capRes.ok) return { ok: false, stage: 'precheck' }
  const { data, error } = await admin.from('bookings').insert({
    guest_name: guestName, guest_phone: '+66900000009', treatment_id: single.id,
    therapist_id: capRes.therapistIds[0], date: D_MAIN, time_slot: '18:00', duration: 60,
    status: 'pending', source: 'online',
  }).select('id').single()
  if (data?.id) cleanup.bookings.push(data.id)
  return { ok: !error, id: data?.id, error }
}
const [raceA, raceB] = await Promise.all([simulatePublicBook('ZZTEST Race A'), simulatePublicBook('ZZTEST Race B')])
const winners = [raceA, raceB].filter(r => r.ok)
const loser = [raceA, raceB].find(r => !r.ok)
check('I1 race: exactly ONE of two simultaneous bookings wins the last slot', winners.length === 1,
  `winners=${winners.length}`)
check('I2 race loser rejected by trigger with THERAPIST_DOUBLE_BOOKED',
  capacityErrorFromDb(loser?.error)?.reason === 'no_therapist', String(loser?.error?.message ?? loser?.stage))

// Direct sequential double-book attempt (bypassing pre-check entirely).
const { error: dblErr } = await admin.from('bookings').insert({
  guest_name: 'ZZTEST Direct Dbl', guest_phone: '+66900000009', treatment_id: single.id,
  therapist_id: T1, date: D_MAIN, time_slot: '18:00', duration: 60, status: 'pending', source: 'online',
}).select('id').single()
check('I3 direct overlapping insert on a busy therapist rejected even without pre-check',
  capacityErrorFromDb(dblErr)?.reason === 'no_therapist', String(dblErr?.message))

// Deliberate staff overbook bypasses the trigger and is recorded on the row.
const { data: obRow, error: obErr } = await admin.from('bookings').insert({
  guest_name: 'ZZTEST Overbook', guest_phone: '+66900000009', treatment_id: single.id,
  therapist_id: T1, date: D_MAIN, time_slot: '18:00', duration: 60, status: 'pending', source: 'walk_in',
  overbooked: true,
}).select('id, overbooked').single()
if (obRow?.id) cleanup.bookings.push(obRow.id)
check('I4 overbooked=true bypasses the trigger (deliberate staff overbook preserved)', !obErr && obRow?.overbooked === true, String(obErr?.message ?? ''))

// Physical room overflow backstop: fill every room at 20:30 (no shifts
// needed — therapist-null bookings), then the next plain insert must fail.
const roomFillers = []
for (let i = 0; i < roomCount; i++) {
  roomFillers.push(await makeBooking({ therapist_id: null, time_slot: '20:30', duration: 30, status: 'pending' }))
}
const { error: roomErr } = await admin.from('bookings').insert({
  guest_name: 'ZZTEST RoomOverflow', guest_phone: '+66900000009', treatment_id: single.id,
  therapist_id: null, date: D_MAIN, time_slot: '20:30', duration: 30, status: 'pending', source: 'online',
}).select('id').single()
check(`I5 trigger blocks insert past physical room capacity (${roomCount})`,
  capacityErrorFromDb(roomErr)?.reason === 'no_room', String(roomErr?.message))

// Reactivating a cancelled booking into a now-conflicting window must fail:
// the chat booking moved to 15:00 (T1) in section H; flip the cancelled
// 16:00 booking onto that same window and back to confirmed in one update.
const { error: reactErr } = await admin.from('bookings')
  .update({ time_slot: '15:00', status: 'confirmed' }).eq('id', bCancelled).select('id').single()
check('I6 cancelled→confirmed reactivation into a conflicting slot rejected (UPDATE path)',
  capacityErrorFromDb(reactErr)?.reason === 'no_therapist', String(reactErr?.message))

// ══ Cleanup ══════════════════════════════════════════════════════
console.log('\n═ Cleanup')
const del = async (label, fn) => { const { error } = await fn(); console.log(`  ${error ? '✗' : '✓'} ${label}${error ? ' — ' + error.message : ''}`) }
await del('booking_logs', () => admin.from('booking_logs').delete().in('booking_id', cleanup.bookings))
await del('conversation threads/messages', async () => {
  const { data: threads } = await admin.from('conversation_threads').select('id').in('web_session_id', cleanup.sessions)
  const ids = (threads ?? []).map(t => t.id)
  if (ids.length) {
    await admin.from('conversation_messages').delete().in('thread_id', ids)
    return admin.from('conversation_threads').delete().in('id', ids)
  }
  return {}
})
await del(`bookings (${cleanup.bookings.length})`, () => admin.from('bookings').delete().in('id', cleanup.bookings))
await del('chat_sessions', () => admin.from('chat_sessions').delete().in('session_id', cleanup.sessions))
await del('customers (test phones)', () => admin.from('customers').delete().in('primary_phone_e164', ['+66900000001', '+66900000002', '+66900000009']))
await del('blocked_dates', () => admin.from('blocked_dates').delete().in('id', cleanup.blocks))
await del('therapist_shifts', () => admin.from('therapist_shifts').delete().in('id', cleanup.shifts))
await del('therapist_treatments', () => admin.from('therapist_treatments').delete().in('therapist_id', cleanup.therapists))
await del('therapists', () => admin.from('therapists').delete().in('id', cleanup.therapists))

// Verify nothing remains on fixture dates
const { data: leftover } = await admin.from('bookings').select('id').in('date', [D_MAIN, D_CLOSED, D_BLOCK])
console.log(`  leftover rows on fixture dates: ${leftover?.length ?? 0}`)

console.log(`\n════ RESULT: ${pass} passed, ${fail} failed ════`)
if (failures.length) console.log('Failed:', failures.join(' | '))
process.exit(fail > 0 ? 1 : 0)
