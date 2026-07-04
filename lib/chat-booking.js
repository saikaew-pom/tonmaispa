import { randomUUID } from 'crypto'
import { z } from 'zod'
import { sendEmail, bookingGuestHtml, bookingOwnerHtml } from '@/lib/brevo'
import { checkSlotCapacity, getAvailableSlots } from '@/lib/scheduling'
import { upsertGuest } from '@/lib/guests'

const DRAFT_LIFETIME_MS = 15 * 60 * 1000

const bookingDraftSchema = z.object({
  guest_name: z.string().trim().min(2).max(100),
  guest_phone: z.string().trim().min(7).max(20),
  guest_email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  treatment_id: z.string().uuid().optional(),
  treatment_name: z.string().trim().min(2).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(30).max(480),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function prepareBookingDraft(admin, sessionId, rawInput) {
  const parsed = bookingDraftSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, error: 'Some booking details are missing or invalid. Please ask the guest to check them.' }
  }

  const input = parsed.data
  const treatment = await resolveTreatment(admin, input)
  if (!treatment) return { ok: false, error: 'Unknown treatment — ask the guest which treatment from the menu they mean.' }
  if (!(treatment.duration_options ?? []).includes(input.duration)) {
    return { ok: false, error: 'That duration is not offered for this treatment.' }
  }

  const capacity = await checkCapacityWithAlternatives(admin, treatment.id, input)
  if (!capacity.ok) return capacity

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + DRAFT_LIFETIME_MS).toISOString()
  const price = treatment.prices?.[String(input.duration)] ?? null
  const { data: existing } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', sessionId).maybeSingle()

  const draft = {
    token,
    expires_at: expiresAt,
    guest_name: input.guest_name,
    guest_phone: input.guest_phone,
    guest_email: input.guest_email || null,
    treatment_id: treatment.id,
    treatment_name: treatment.name,
    date: input.date,
    time_slot: input.time_slot,
    duration: input.duration,
    price,
    notes: input.notes || null,
  }

  const { error } = await admin.from('chat_sessions').upsert({
    session_id: sessionId,
    guest_name: input.guest_name,
    guest_phone: input.guest_phone,
    metadata: { ...(existing?.metadata ?? {}), booking_draft: draft },
    last_active: new Date().toISOString(),
  }, { onConflict: 'session_id' })

  if (error) return { ok: false, error: 'I could not prepare the booking summary. Please try again.' }

  return {
    ok: true,
    draft_ready: true,
    token,
    expires_at: expiresAt,
    summary: {
      guest_name: draft.guest_name,
      guest_phone: maskPhone(draft.guest_phone),
      treatment: draft.treatment_name,
      date: draft.date,
      time: draft.time_slot,
      duration: draft.duration,
      price: draft.price,
    },
    message: 'Booking details are ready for the guest to review. Nothing has been booked yet.',
  }
}

export async function confirmBookingDraft(admin, { sessionId, token, settings, sendNotifications = true }) {
  const { data: session, error: sessionError } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', sessionId).maybeSingle()
  if (sessionError || !session) return { ok: false, status: 404, error: 'Booking draft not found.' }

  const draft = session.metadata?.booking_draft
  if (!draft || draft.token !== token) return { ok: false, status: 404, error: 'This booking draft is no longer available.' }
  if (!draft.expires_at || Date.parse(draft.expires_at) <= Date.now()) {
    await clearDraft(admin, sessionId, session.metadata)
    return { ok: false, status: 410, error: 'This booking summary expired. Please ask the chatbot to check availability again.' }
  }

  const parsed = bookingDraftSchema.safeParse(draft)
  if (!parsed.success || !draft.treatment_id) {
    await clearDraft(admin, sessionId, session.metadata)
    return { ok: false, status: 400, error: 'This booking draft is invalid. Please prepare it again.' }
  }

  const capacity = await checkCapacityWithAlternatives(admin, draft.treatment_id, draft)
  if (!capacity.ok) {
    return { ...capacity, status: 409 }
  }

  const guestId = await upsertGuest(admin, { name: draft.guest_name, phone: draft.guest_phone, email: draft.guest_email })

  const { data: booking, error } = await admin.from('bookings').insert({
    guest_name: draft.guest_name,
    guest_phone: draft.guest_phone,
    guest_email: draft.guest_email || null,
    guest_id: guestId,
    treatment_id: draft.treatment_id,
    therapist_id: capacity.therapistIds[0],
    secondary_therapist_id: capacity.therapistIds[1] ?? null,
    date: draft.date,
    time_slot: draft.time_slot,
    duration: draft.duration,
    price: draft.price,
    notes: draft.notes || null,
    source: 'chatbot',
    chat_session_id: sessionId,
    status: 'pending',
  }).select('id, ref_code, date, time_slot').single()

  if (error) {
    console.error('[chat booking] insert error:', error)
    return { ok: false, status: 500, error: 'Could not save the booking. Please contact us via WhatsApp.' }
  }

  await clearDraft(admin, sessionId, session.metadata)

  if (sendNotifications) {
    const whatsapp = settings?.['settings.whatsapp_number'] ?? '66631175211'
    const ownerEmail = process.env.INQUIRY_EMAIL
    await Promise.allSettled([
      draft.guest_email && sendEmail({
        to: draft.guest_email,
        subject: `Booking Request Received — ${booking.ref_code} — Ton Mai Spa`,
        html: bookingGuestHtml({
          name: draft.guest_name, refCode: booking.ref_code, date: booking.date,
          time: booking.time_slot, treatment: draft.treatment_name, whatsapp,
        }),
      }),
      ownerEmail && sendEmail({
        to: ownerEmail,
        subject: `New Booking ${booking.ref_code} — ${draft.treatment_name} (chatbot)`,
        html: bookingOwnerHtml({
          name: draft.guest_name, phone: draft.guest_phone, refCode: booking.ref_code,
          date: booking.date, time: booking.time_slot, treatment: draft.treatment_name,
          notes: draft.notes,
        }),
      }),
    ])
  }

  return {
    ok: true,
    status: 'pending',
    ref_code: booking.ref_code,
    booking_id: booking.id,
    message: 'Booking request received. The spa team will confirm it with the guest.',
  }
}

async function checkCapacityWithAlternatives(admin, treatmentId, input) {
  const endTime = addMinutesStr(input.time_slot, input.duration)
  const capacity = await checkSlotCapacity(admin, {
    treatmentId, date: input.date, startTime: input.time_slot, endTime,
  })
  if (capacity.ok) return capacity

  const { slots } = await getAvailableSlots(admin, {
    date: input.date, treatmentId, duration: input.duration,
  })
  return {
    ok: false,
    error: 'This slot is no longer available.',
    nearest_open_times: slots.filter(slot => slot.available).map(slot => slot.time).slice(0, 6),
  }
}

async function clearDraft(admin, sessionId, metadata) {
  const nextMetadata = { ...(metadata ?? {}) }
  delete nextMetadata.booking_draft
  await admin.from('chat_sessions').update({
    metadata: nextMetadata,
    last_active: new Date().toISOString(),
  }).eq('session_id', sessionId)
}

async function resolveTreatment(admin, input) {
  if (input.treatment_id) {
    const { data } = await admin.from('spa_treatments')
      .select('id, name, prices, duration_options')
      .eq('id', input.treatment_id).eq('is_active', true).maybeSingle()
    if (data) return data
  }
  if (input.treatment_name) {
    const safeName = input.treatment_name.replace(/[%_]/g, '')
    const { data } = await admin.from('spa_treatments')
      .select('id, name, prices, duration_options')
      .ilike('name', `%${safeName}%`).eq('is_active', true).limit(1).maybeSingle()
    if (data) return data
  }
  return null
}

function addMinutesStr(time, mins) {
  const [hours, minutes] = time.split(':').map(Number)
  const total = hours * 60 + minutes + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function maskPhone(phone) {
  const clean = String(phone)
  return clean.length <= 4 ? clean : `${'•'.repeat(Math.min(6, clean.length - 4))}${clean.slice(-4)}`
}
