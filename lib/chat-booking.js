import { randomUUID } from 'crypto'
import { z } from 'zod'
import { sendEmail, bookingGuestHtml, bookingOwnerHtml, bookingRescheduledHtml, bookingCancelledHtml } from '@/lib/brevo'
import { sendWhatsAppMessage } from '@/lib/twilio'
import { checkSlotCapacity, getAvailableSlots, capacityErrorFromDb, isPastSlotInSpaTz } from '@/lib/scheduling'
import { upsertCustomer } from '@/lib/customers'
import { logBookingAction } from '@/lib/booking-logs'
import { appendConversationMessage, conversationDedupeKey, getOrCreateWebThread } from '@/lib/conversations'

const DRAFT_LIFETIME_MS = 15 * 60 * 1000

// Best-effort WhatsApp to the guest for guest-initiated events (booking made,
// rescheduled, cancelled from the chat). These are transactional receipts for
// something the GUEST just did — different from staff status notifications,
// which stay human-triggered. Fails open: a Twilio problem must never break
// the booking action itself. Note WhatsApp only delivers freeform text inside
// the guest's 24h session window; outside it this send is silently dropped by
// WhatsApp, which is acceptable for a best-effort duplicate of the email.
async function notifyGuestWhatsApp(admin, settings, { phone, body }) {
  try {
    const enabled = ['true', '1', 'yes', 'on', 'enabled'].includes(String(settings?.['settings.twilio_whatsapp_enabled'] ?? '').trim().toLowerCase())
    const configured = Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
    )
    if (!enabled || !configured || !phone) return false
    await sendWhatsAppMessage({ to: phone, body })
    return true
  } catch (err) {
    console.error('[chat booking] guest WhatsApp failed:', err.message)
    return false
  }
}

const bookingDraftSchema = z.object({
  // Name, phone, and email are all just placeholders at this stage, if the
  // AI happens to have them from the conversation — the real values are
  // captured and validated on the review card itself, right before confirm
  // (contactDetailsSchema below). This also lets one booker book a second,
  // separate treatment for a companion in the same chat: each review card
  // gets its own fresh name, while phone/email carry forward for convenience.
  guest_name: z.string().trim().max(100).optional().or(z.literal('')).nullable(),
  guest_phone: z.string().trim().max(20).optional().or(z.literal('')).nullable(),
  guest_email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  treatment_id: z.string().uuid().optional(),
  treatment_name: z.string().trim().min(2).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(30).max(480),
  notes: z.string().trim().max(500).optional().nullable(),
})

// Final identity + contact details are collected via a structured form in
// the review card, not trusted from whatever the AI parsed out of
// free-text chat — guest_phone here must already be a full E.164-style
// number (country code + number, composed client-side from an explicit
// country selector), closing the gap where an international guest might
// type only a local-format number with no country code.
export const contactDetailsSchema = z.object({
  guest_name: z.string().trim().min(2, 'Please enter the guest\'s name.').max(100),
  guest_phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must include a country code.'),
  guest_email: z.string().trim().email('Please enter a valid email address.'),
})

const rescheduleDraftSchema = z.object({
  token: z.string().uuid(),
  expires_at: z.string().datetime(),
  booking_id: z.string().uuid(),
  ref_code: z.string().min(1).max(50),
  treatment_id: z.string().uuid(),
  treatment_name: z.string().min(2).max(200),
  old_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  old_time_slot: z.string().regex(/^\d{2}:\d{2}$/),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_time_slot: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(30).max(480),
  price: z.number().nullable().optional(),
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
    guest_phone: input.guest_phone || null,
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
    guest_phone: input.guest_phone || null,
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

export async function confirmBookingDraft(admin, { sessionId, token, settings, sendNotifications = true, guest_name, guest_phone, guest_email }) {
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

  // The guest confirms/enters these directly in the review form right
  // before submitting — never trust a name/phone/email the AI may have
  // parsed loosely (or invented, e.g. a placeholder "Guest") out of
  // free-text chat. Required regardless of what the draft already had, so
  // an international guest can't slip through with a country-code-less
  // number, and a companion's booking always gets their own real name.
  const contact = contactDetailsSchema.safeParse({ guest_name, guest_phone, guest_email })
  if (!contact.success) {
    return { ok: false, status: 400, error: contact.error.issues[0]?.message ?? 'Please provide the guest\'s name, a valid phone number (with country code), and email.' }
  }

  const capacity = await checkCapacityWithAlternatives(admin, draft.treatment_id, draft)
  if (!capacity.ok) {
    return { ...capacity, status: 409 }
  }

  const customerId = await upsertCustomer(admin, { name: contact.data.guest_name, phone: contact.data.guest_phone, email: contact.data.guest_email })
  if (customerId) {
    await Promise.all([
      admin.from('chat_sessions').update({ customer_id: customerId }).eq('session_id', sessionId),
      admin.from('conversation_threads').update({ customer_id: customerId }).eq('web_session_id', sessionId),
    ])
  }

  const { data: booking, error } = await admin.from('bookings').insert({
    guest_name: contact.data.guest_name,
    guest_phone: contact.data.guest_phone,
    guest_email: contact.data.guest_email,
    customer_id: customerId,
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
    // DB capacity trigger backstop — a simultaneous booking won the race
    // between our capacity re-check and this insert. Same guest-facing
    // outcome as a failed pre-check: slot gone, offer alternatives.
    if (capacityErrorFromDb(error)) {
      const retry = await checkCapacityWithAlternatives(admin, draft.treatment_id, draft)
      return { ...(retry.ok ? { ok: false, error: 'This slot was just taken. Please pick another time.', nearest_open_times: [] } : retry), status: 409 }
    }
    console.error('[chat booking] insert error:', error)
    return { ok: false, status: 500, error: 'Could not save the booking. Please contact us via WhatsApp.' }
  }

  await clearDraft(admin, sessionId, session.metadata)

  if (sendNotifications) {
    const whatsapp = settings?.['settings.whatsapp_number'] ?? '66822866058'
    const ownerEmail = process.env.INQUIRY_EMAIL
    await Promise.allSettled([
      sendEmail({
        to: contact.data.guest_email,
        subject: `Booking Request Received — ${booking.ref_code} — Ton Mai Spa`,
        html: bookingGuestHtml({
          name: contact.data.guest_name, refCode: booking.ref_code, date: booking.date,
          time: booking.time_slot, treatment: draft.treatment_name, whatsapp,
        }),
      }),
      ownerEmail && sendEmail({
        to: ownerEmail,
        subject: `New Booking ${booking.ref_code} — ${draft.treatment_name} (chatbot)`,
        html: bookingOwnerHtml({
          name: contact.data.guest_name, phone: contact.data.guest_phone, refCode: booking.ref_code,
          date: booking.date, time: booking.time_slot, treatment: draft.treatment_name,
          notes: draft.notes,
        }),
      }),
      notifyGuestWhatsApp(admin, settings, {
        phone: contact.data.guest_phone,
        body: `Ton Mai Spa: We received your booking request ${booking.ref_code} — ${draft.treatment_name} on ${booking.date} at ${booking.time_slot?.slice(0, 5)}. It is pending confirmation; our team will contact you shortly. Questions? +${whatsapp}`,
      }),
    ])
  }

  return {
    ok: true,
    status: 'pending',
    ref_code: booking.ref_code,
    booking_id: booking.id,
    whatsapp: settings?.['settings.whatsapp_number'] ?? '66822866058',
    message: 'Booking request received and pending confirmation. The spa team will contact the guest, or they can wait for the confirmation email.',
  }
}

export async function listSessionBookings(admin, sessionId) {
  const accessCustomerId = await getBookingAccessCustomerId(admin, sessionId)
  let query = admin.from('bookings')
    .select('id, ref_code, date, time_slot, duration, price, status, treatment_id, spa_treatments(name)')
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(10)
  query = accessCustomerId
    ? query.eq('customer_id', accessCustomerId)
    : query.eq('chat_session_id', sessionId)
  const { data, error } = await query

  if (error) return { ok: false, error: 'I could not retrieve the bookings for this chat.' }
  return {
    ok: true,
    bookings: (data ?? []).map(booking => ({
      booking_id: booking.id,
      ref_code: booking.ref_code,
      treatment: booking.spa_treatments?.name ?? 'Spa treatment',
      date: booking.date,
      time: booking.time_slot?.slice(0, 5),
      duration: booking.duration,
      price: booking.price,
      status: booking.status,
    })),
  }
}

export async function getRescheduleAvailability(admin, sessionId, rawInput) {
  const booking = await resolveOwnedBooking(admin, sessionId, rawInput)
  if (booking.error) return booking.error

  const date = String(rawInput.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Please ask the guest which date they would like.' }
  }

  const { slots, closed } = await getAvailableSlots(admin, {
    date,
    treatmentId: booking.data.treatment_id,
    duration: booking.data.duration,
    excludeBookingId: booking.data.id,
  })
  if (closed) return { ok: true, available: false, message: 'The spa is closed on this date.' }

  const openTimes = slots.filter(slot => slot.available).map(slot => slot.time)
  const { data: session } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', sessionId).maybeSingle()
  await admin.from('chat_sessions').upsert({
    session_id: sessionId,
    metadata: {
      ...(session?.metadata ?? {}),
      reschedule_context: {
        booking_id: booking.data.id,
        ref_code: booking.data.ref_code,
        requested_date: date,
      },
    },
    last_active: new Date().toISOString(),
  }, { onConflict: 'session_id' })

  return {
    ok: true,
    available: openTimes.length > 0,
    booking_id: booking.data.id,
    ref_code: booking.data.ref_code,
    treatment: booking.data.spa_treatments?.name ?? 'Spa treatment',
    current_date: booking.data.date,
    current_time: booking.data.time_slot?.slice(0, 5),
    requested_date: date,
    duration: booking.data.duration,
    price: booking.data.price,
    open_times: openTimes,
    message: openTimes.length ? undefined : 'No alternative times are open on this date. Please suggest another date.',
  }
}

export async function prepareRescheduleDraft(admin, sessionId, rawInput) {
  const booking = await resolveOwnedBooking(admin, sessionId, rawInput)
  if (booking.error) return booking.error

  const newDate = String(rawInput.date ?? '')
  const newTime = String(rawInput.time_slot ?? '').slice(0, 5)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{2}:\d{2}$/.test(newTime)) {
    return { ok: false, error: 'The new date or time is missing or invalid.' }
  }
  if (isPastSlotInSpaTz(newDate, newTime)) {
    return { ok: false, error: 'That new date/time has already passed. Please pick an upcoming time.' }
  }

  const endTime = addMinutesStr(newTime, booking.data.duration)
  const capacity = await checkSlotCapacity(admin, {
    treatmentId: booking.data.treatment_id,
    date: newDate,
    startTime: newTime,
    endTime,
    excludeBookingId: booking.data.id,
  })
  if (!capacity.ok) {
    const alternatives = await getRescheduleAvailability(admin, sessionId, { booking_id: booking.data.id, date: newDate })
    return {
      ok: false,
      error: 'That new time is no longer available.',
      nearest_open_times: alternatives.open_times ?? [],
    }
  }

  const { data: session } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', sessionId).maybeSingle()
  const token = randomUUID()
  const draft = {
    token,
    expires_at: new Date(Date.now() + DRAFT_LIFETIME_MS).toISOString(),
    booking_id: booking.data.id,
    ref_code: booking.data.ref_code,
    treatment_id: booking.data.treatment_id,
    treatment_name: booking.data.spa_treatments?.name ?? 'Spa treatment',
    old_date: booking.data.date,
    old_time_slot: booking.data.time_slot?.slice(0, 5),
    new_date: newDate,
    new_time_slot: newTime,
    duration: booking.data.duration,
    price: booking.data.price,
  }

  const { error } = await admin.from('chat_sessions').upsert({
    session_id: sessionId,
    metadata: { ...(session?.metadata ?? {}), reschedule_draft: draft },
    last_active: new Date().toISOString(),
  }, { onConflict: 'session_id' })
  if (error) return { ok: false, error: 'I could not prepare the reschedule review. Please try again.' }

  return { ok: true, reschedule_ready: true, ...draft }
}

export async function confirmRescheduleDraft(admin, { sessionId, token, settings }) {
  const { data: session, error: sessionError } = await admin.from('chat_sessions')
    .select('metadata, messages, customer_id').eq('session_id', sessionId).maybeSingle()
  if (sessionError || !session) return { ok: false, status: 404, error: 'Reschedule review not found.' }

  const parsed = rescheduleDraftSchema.safeParse(session.metadata?.reschedule_draft)
  if (!parsed.success || parsed.data.token !== token) {
    return { ok: false, status: 404, error: 'This reschedule review is no longer available.' }
  }
  const draft = parsed.data
  if (Date.parse(draft.expires_at) <= Date.now()) {
    await clearRescheduleDraft(admin, sessionId, session.metadata)
    return { ok: false, status: 410, error: 'This reschedule review expired. Please check availability again.' }
  }

  const accessCustomerId = await getBookingAccessCustomerId(admin, sessionId)
  let bookingQuery = admin.from('bookings')
    .select('id, ref_code, status, customer_id, chat_session_id, guest_name, guest_email, guest_phone').eq('id', draft.booking_id)
  bookingQuery = accessCustomerId
    ? bookingQuery.eq('customer_id', accessCustomerId)
    : bookingQuery.eq('chat_session_id', sessionId)
  const { data: booking } = await bookingQuery.maybeSingle()
  if (!booking || !['pending', 'confirmed'].includes(booking.status)) {
    await clearRescheduleDraft(admin, sessionId, session.metadata)
    return { ok: false, status: 409, error: 'This booking can no longer be rescheduled in chat.' }
  }

  // A draft prepared minutes ago can cross into the past by confirm time
  // (e.g. prepared 13:55 for a 14:00 start, confirmed 14:05).
  if (isPastSlotInSpaTz(draft.new_date, draft.new_time_slot)) {
    return { ok: false, status: 409, error: 'That time has already passed. Please check availability again.' }
  }
  const capacity = await checkSlotCapacity(admin, {
    treatmentId: draft.treatment_id,
    date: draft.new_date,
    startTime: draft.new_time_slot,
    endTime: addMinutesStr(draft.new_time_slot, draft.duration),
    excludeBookingId: draft.booking_id,
  })
  if (!capacity.ok) {
    return { ok: false, status: 409, error: 'That time has just become unavailable. Please choose another time.' }
  }

  let updateQuery = admin.from('bookings').update({
    date: draft.new_date,
    time_slot: draft.new_time_slot,
    therapist_id: capacity.therapistIds[0],
    secondary_therapist_id: capacity.therapistIds[1] ?? null,
    status: 'pending',
  }).eq('id', draft.booking_id)
  updateQuery = accessCustomerId
    ? updateQuery.eq('customer_id', accessCustomerId)
    : updateQuery.eq('chat_session_id', sessionId)
  const { error } = await updateQuery
  if (error) {
    // DB capacity trigger backstop — the new slot was taken between our
    // re-check and this update.
    if (capacityErrorFromDb(error)) {
      return { ok: false, status: 409, error: 'That time has just become unavailable. Please choose another time.' }
    }
    return { ok: false, status: 500, error: 'Could not update the booking. Please contact the spa team.' }
  }

  await clearRescheduleDraft(admin, sessionId, session.metadata)
  const confirmationText = `Booking ${draft.ref_code} change requested: ${draft.treatment_name} moved from ${draft.old_date} at ${draft.old_time_slot} to ${draft.new_date} at ${draft.new_time_slot}. The reference is unchanged and the new time is pending staff confirmation.`
  const nextMessages = [
    ...((session.messages ?? []).slice(-38)),
    { role: 'assistant', content: confirmationText, timestamp: new Date().toISOString() },
  ]
  await admin.from('chat_sessions').update({ messages: nextMessages }).eq('session_id', sessionId)

  try {
    const thread = await getOrCreateWebThread(admin, sessionId, booking.customer_id || session.customer_id)
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'system',
      channel: 'web',
      body: confirmationText,
      dedupeKey: conversationDedupeKey('web-reschedule', `${sessionId}:${draft.booking_id}:${draft.new_date}:${draft.new_time_slot}`),
      metadata: { booking_id: draft.booking_id, ref_code: draft.ref_code, event: 'reschedule_requested' },
    })
  } catch (timelineError) {
    console.error('[chat reschedule] timeline write failed:', timelineError)
  }

  await logBookingAction(admin, {
    bookingId: draft.booking_id,
    actorEmail: 'verified web-chat guest',
    action: 'reschedule_requested',
    detail: `${draft.old_date} ${draft.old_time_slot} → ${draft.new_date} ${draft.new_time_slot}; status set to pending`,
  })

  const whatsapp = settings?.['settings.whatsapp_number'] ?? '66822866058'
  let emailSent = false
  if (booking.guest_email) {
    const emailResult = await sendEmail({
      to: booking.guest_email,
      subject: `Booking Change Received — ${draft.ref_code} — Ton Mai Spa`,
      html: bookingRescheduledHtml({
        name: booking.guest_name,
        refCode: draft.ref_code,
        oldDate: draft.old_date,
        oldTime: draft.old_time_slot,
        date: draft.new_date,
        time: draft.new_time_slot,
        treatment: draft.treatment_name,
        whatsapp,
      }),
    })
    emailSent = emailResult.ok
    if (emailSent) {
      const sentAt = new Date().toISOString()
      await admin.from('bookings').update({
        last_email_sent_at: sentAt,
        last_email_status: 'pending',
      }).eq('id', draft.booking_id)
      await logBookingAction(admin, {
        bookingId: draft.booking_id,
        actorEmail: 'system',
        action: 'email_sent',
        detail: `Reschedule request email sent to ${booking.guest_email}`,
      })
    }
  }

  await notifyGuestWhatsApp(admin, settings, {
    phone: booking.guest_phone,
    body: `Ton Mai Spa: Your booking ${draft.ref_code} (${draft.treatment_name}) was moved to ${draft.new_date} at ${draft.new_time_slot}. The new time is pending confirmation by our team. Questions? +${whatsapp}`,
  })

  // Staff must re-confirm the new time (status went back to pending above) —
  // so the owner needs to KNOW a guest moved it. Best-effort, never blocking.
  if (process.env.INQUIRY_EMAIL) {
    await sendEmail({
      to: process.env.INQUIRY_EMAIL,
      subject: `Guest moved booking ${draft.ref_code} — needs re-confirmation`,
      html: bookingOwnerHtml({
        name: booking.guest_name,
        phone: booking.guest_phone,
        refCode: draft.ref_code,
        date: draft.new_date,
        time: draft.new_time_slot,
        treatment: draft.treatment_name,
        notes: `Guest rescheduled via chat: was ${draft.old_date} at ${draft.old_time_slot}. Status is back to PENDING — confirm in the dashboard, then send the update email/WhatsApp.`,
      }),
    })
  }

  return {
    ok: true,
    status: 'pending',
    booking_id: draft.booking_id,
    ref_code: draft.ref_code,
    date: draft.new_date,
    time: draft.new_time_slot,
    email_sent: emailSent,
    message: 'The original booking was updated. The reference number is unchanged and the new time is pending staff confirmation.',
  }
}

async function checkCapacityWithAlternatives(admin, treatmentId, input) {
  // The AI resolves relative dates ("tomorrow", "next Tuesday") from the
  // prompt — if it ever resolves one into the past, refuse here rather than
  // let a booking for yesterday reach the insert. Covers both the prepare
  // and confirm steps, since both re-check through this function.
  if (isPastSlotInSpaTz(input.date, input.time_slot)) {
    return { ok: false, error: 'That date/time has already passed. Please pick an upcoming time and check availability again.' }
  }
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

async function clearRescheduleDraft(admin, sessionId, metadata) {
  const nextMetadata = { ...(metadata ?? {}) }
  delete nextMetadata.reschedule_draft
  delete nextMetadata.reschedule_context
  await admin.from('chat_sessions').update({
    metadata: nextMetadata,
    last_active: new Date().toISOString(),
  }).eq('session_id', sessionId)
}

// Guest-initiated cancellation from the chat widget's booking cards. Same
// ownership rule as every other chat action: only bookings created in this
// chat session, or belonging to the customer this session verified as.
// Sets status to cancelled (never deletes — history stays), logs the actor,
// and auto-sends the cancellation email + best-effort WhatsApp, because the
// guest performed the action themselves and expects a receipt.
export async function cancelOwnedBooking(admin, { sessionId, bookingId, bookingRef, settings }) {
  const resolved = await resolveOwnedBooking(admin, sessionId, { booking_id: bookingId, booking_ref: bookingRef })
  if (resolved.error) return { ...resolved.error, status: 404 }
  const booking = resolved.data

  const accessCustomerId = await getBookingAccessCustomerId(admin, sessionId)
  let updateQuery = admin.from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .in('status', ['pending', 'confirmed'])
  updateQuery = accessCustomerId
    ? updateQuery.eq('customer_id', accessCustomerId)
    : updateQuery.eq('chat_session_id', sessionId)
  const { data: updated, error } = await updateQuery.select('id, ref_code, date, time_slot, duration, guest_name, guest_email, guest_phone').maybeSingle()
  if (error || !updated) {
    return { ok: false, status: 409, error: 'This booking could not be cancelled from chat. Please contact the spa team.' }
  }

  await logBookingAction(admin, {
    bookingId: booking.id,
    actorEmail: accessCustomerId ? 'verified web-chat guest' : 'web-chat guest (same session)',
    action: 'status_changed',
    detail: `status: ${booking.status} → cancelled (guest self-service via chat)`,
  })

  const whatsapp = settings?.['settings.whatsapp_number'] ?? '66822866058'
  const treatmentName = booking.spa_treatments?.name ?? 'Spa treatment'
  let emailSent = false
  if (updated.guest_email) {
    const emailResult = await sendEmail({
      to: updated.guest_email,
      subject: `Booking Cancelled — ${updated.ref_code} — Ton Mai Spa`,
      html: bookingCancelledHtml({
        name: updated.guest_name,
        refCode: updated.ref_code,
        date: updated.date,
        time: updated.time_slot?.slice(0, 5),
        treatment: treatmentName,
        whatsapp,
      }),
    })
    emailSent = emailResult.ok
    if (emailSent) {
      const sentAt = new Date().toISOString()
      await admin.from('bookings').update({ last_email_sent_at: sentAt, last_email_status: 'cancelled' }).eq('id', booking.id)
      await logBookingAction(admin, {
        bookingId: booking.id,
        actorEmail: 'system',
        action: 'email_sent',
        detail: `Cancellation email sent to ${updated.guest_email}`,
      })
    }
  }

  await notifyGuestWhatsApp(admin, settings, {
    phone: updated.guest_phone,
    body: `Ton Mai Spa: Your booking ${updated.ref_code} (${treatmentName}) on ${updated.date} at ${updated.time_slot?.slice(0, 5)} has been cancelled as you requested. We hope to welcome you another time — to rebook, message us: +${whatsapp}`,
  })

  // Tell the owner a slot just freed up — cancellations change today's plan.
  if (process.env.INQUIRY_EMAIL) {
    await sendEmail({
      to: process.env.INQUIRY_EMAIL,
      subject: `Guest cancelled booking ${updated.ref_code} — slot freed`,
      html: bookingOwnerHtml({
        name: updated.guest_name,
        phone: updated.guest_phone,
        refCode: updated.ref_code,
        date: updated.date,
        time: updated.time_slot?.slice(0, 5),
        treatment: treatmentName,
        notes: 'Guest cancelled this booking themselves via the website chat. No action needed unless you want to follow up.',
      }),
    })
  }

  return {
    ok: true,
    ref_code: updated.ref_code,
    date: updated.date,
    time: updated.time_slot?.slice(0, 5),
    treatment: treatmentName,
    email_sent: emailSent,
  }
}

async function resolveOwnedBooking(admin, sessionId, input) {
  let bookingId = input.booking_id
  if (!bookingId && !input.booking_ref) {
    const { data: session } = await admin.from('chat_sessions')
      .select('metadata').eq('session_id', sessionId).maybeSingle()
    bookingId = session?.metadata?.reschedule_context?.booking_id
  }

  const accessCustomerId = await getBookingAccessCustomerId(admin, sessionId)
  let query = admin.from('bookings')
    .select('id, ref_code, date, time_slot, duration, price, status, treatment_id, spa_treatments(name)')
    .in('status', ['pending', 'confirmed'])
  query = accessCustomerId
    ? query.eq('customer_id', accessCustomerId)
    : query.eq('chat_session_id', sessionId)

  if (bookingId) query = query.eq('id', bookingId)
  else if (input.booking_ref) query = query.ilike('ref_code', String(input.booking_ref).trim())

  const { data, error } = await query.order('created_at', { ascending: false }).limit(10)
  if (error) return { error: { ok: false, error: 'I could not retrieve that booking.' } }
  if (!data?.length) return { error: { ok: false, error: 'No active booking from this chat matched that reference.' } }
  if (!bookingId && !input.booking_ref && data.length > 1) {
    return {
      error: {
        ok: false,
        error: 'There is more than one active booking in this chat. Ask the guest which reference they want to change.',
        bookings: data.map(item => ({ ref_code: item.ref_code, treatment: item.spa_treatments?.name, date: item.date, time: item.time_slot?.slice(0, 5) })),
      },
    }
  }
  return { data: data[0] }
}

async function getBookingAccessCustomerId(admin, sessionId) {
  const { data: session } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', sessionId).maybeSingle()
  const access = session?.metadata?.booking_access
  if (!access?.customer_id || !access.expires_at || Date.parse(access.expires_at) <= Date.now()) return null
  return access.customer_id
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
  if (!phone) return null
  const clean = String(phone)
  return clean.length <= 4 ? clean : `${'•'.repeat(Math.min(6, clean.length - 4))}${clean.slice(-4)}`
}
