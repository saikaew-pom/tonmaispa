import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isMaintenanceMode, maintenanceResponse } from '@/lib/maintenance'
import { checkSlotCapacity, capacityErrorFromDb, isPastSlotInSpaTz } from '@/lib/scheduling'
import { upsertCustomer } from '@/lib/customers'
import { appendConversationMessage } from '@/lib/conversations'
import { sendWhatsAppMessage } from '@/lib/twilio'
import { verifyWhatsAppBookingRequestToken } from '@/lib/whatsapp-booking-request'
import { logBookingAction } from '@/lib/booking-logs'

const requestSchema = z.object({
  token: z.string().min(20),
  guest_name: z.string().trim().min(2, 'Please enter your name.').max(100),
  guest_phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must include country code, e.g. +66869643159.'),
  guest_email: z.string().trim().email('Please enter a valid email address.'),
  treatment_id: z.string().uuid('Please choose a treatment.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please choose a valid date.'),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, 'Please choose a valid time.'),
  duration: z.number().int().min(30).max(480),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function normalizeE164Input(value) {
  const compact = String(value ?? '').trim().replace(/[\s().-]/g, '')
  if (!compact) return ''
  return compact.startsWith('+') ? compact : `+${compact}`
}

function requestReceivedMessage({ refCode, treatment, date, time, whatsapp }) {
  return `Ton Mai Spa: We received your booking request ${refCode} for ${treatment} on ${date} at ${time}. Our team will confirm availability shortly. Questions? +${whatsapp}`
}

export async function POST(req) {
  const body = await req.json().catch(() => null)
  const prepared = body ? { ...body, guest_phone: normalizeE164Input(body.guest_phone) } : null
  const parsed = requestSchema.safeParse(prepared)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || 'Please check your booking details.' }, { status: 400 })
  }

  const token = verifyWhatsAppBookingRequestToken(parsed.data.token)
  if (!token.ok) return Response.json({ error: token.error }, { status: 400 })

  // The form's date picker prevents past dates client-side, but a crafted
  // POST bypasses the UI — same rule as the public booking route.
  if (isPastSlotInSpaTz(parsed.data.date, parsed.data.time_slot)) {
    return Response.json({ error: 'That time has already passed. Please choose an upcoming slot.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // Refuse work behind a "we're closed" page — a crafted POST bypasses the
  // hidden forms, and a booking taken during maintenance is a promise the spa
  // never made. (Read is fresh per request — this route is dynamic, not ISR.)
  if (await isMaintenanceMode(admin)) return maintenanceResponse()
  const { data: thread, error: threadError } = await admin
    .from('conversation_threads')
    .select('id, whatsapp_address, customer_id')
    .eq('id', token.data.thread_id)
    .eq('whatsapp_address', token.data.whatsapp_address)
    .maybeSingle()

  if (threadError || !thread) {
    return Response.json({ error: 'This booking link is no longer connected to a WhatsApp conversation.' }, { status: 404 })
  }

  const [{ data: treatment }, capacity] = await Promise.all([
    admin
      .from('spa_treatments')
      .select('id, name, prices, duration_options')
      .eq('id', parsed.data.treatment_id)
      .eq('is_active', true)
      .maybeSingle(),
    checkSlotCapacity(admin, {
      treatmentId: parsed.data.treatment_id,
      date: parsed.data.date,
      startTime: parsed.data.time_slot,
      endTime: addMinutes(parsed.data.time_slot, parsed.data.duration),
    }),
  ])

  if (!treatment) return Response.json({ error: 'Treatment not found. Please choose another treatment.' }, { status: 404 })
  if (!(treatment.duration_options ?? []).includes(parsed.data.duration)) {
    return Response.json({ error: 'That duration is not offered for this treatment.' }, { status: 400 })
  }
  if (!capacity.ok) {
    return Response.json({ error: 'That time is no longer available. Please choose another time.' }, { status: 409 })
  }

  const customerId = await upsertCustomer(admin, {
    name: parsed.data.guest_name,
    phone: parsed.data.guest_phone,
    email: parsed.data.guest_email,
  })
  if (customerId && !thread.customer_id) {
    await admin.from('conversation_threads').update({ customer_id: customerId }).eq('id', thread.id)
  }

  const price = treatment.prices?.[String(parsed.data.duration)] ?? null
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      guest_name: parsed.data.guest_name,
      guest_phone: parsed.data.guest_phone,
      guest_email: parsed.data.guest_email,
      customer_id: customerId || thread.customer_id || null,
      treatment_id: parsed.data.treatment_id,
      therapist_id: capacity.therapistIds[0],
      secondary_therapist_id: capacity.therapistIds[1] ?? null,
      date: parsed.data.date,
      time_slot: parsed.data.time_slot,
      duration: parsed.data.duration,
      price,
      status: 'pending',
      source: 'chatbot',
      notes: [
        'WhatsApp bot booking request. Staff must confirm before the booking is final.',
        parsed.data.notes ? `Guest note: ${parsed.data.notes}` : null,
      ].filter(Boolean).join('\n'),
    })
    .select('id, ref_code, date, time_slot, duration')
    .single()

  if (bookingError) {
    // DB capacity trigger backstop — the slot was taken in the race window
    // between checkSlotCapacity above and this insert. Graceful 409, exactly
    // like the pre-check failing (this was the one write path returning a
    // raw 500 here; the other five already handled it).
    if (capacityErrorFromDb(bookingError)) {
      return Response.json({ error: 'That time is no longer available. Please choose another time.' }, { status: 409 })
    }
    console.error('[booking request] insert error:', bookingError)
    return Response.json({ error: 'Could not save the booking request. Please message us on WhatsApp.' }, { status: 500 })
  }

  await logBookingAction(admin, {
    bookingId: booking.id,
    actorEmail: null,
    action: 'whatsapp_booking_request_created',
    detail: `Guest submitted booking request from WhatsApp conversation ${thread.id}`,
  })

  const timelineText = `Booking request ${booking.ref_code} created by guest via WhatsApp form: ${treatment.name}, ${booking.date} at ${booking.time_slot?.slice(0, 5)}. Status: pending staff confirmation.`
  await appendConversationMessage(admin, {
    threadId: thread.id,
    senderType: 'system',
    channel: 'web',
    body: timelineText,
    dedupeKey: `booking-request:${booking.id}:system`,
    metadata: {
      source: 'whatsapp_booking_request',
      booking_id: booking.id,
      booking_ref: booking.ref_code,
    },
  })

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66822866058'
  let whatsappStatus = null
  try {
    const message = requestReceivedMessage({
      refCode: booking.ref_code,
      treatment: treatment.name,
      date: booking.date,
      time: booking.time_slot?.slice(0, 5),
      whatsapp,
    })
    const result = await sendWhatsAppMessage({ to: token.data.whatsapp_address, body: message })
    whatsappStatus = result.status || 'queued'
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'bot',
      channel: 'whatsapp',
      body: message,
      twilioMessageSid: result.sid,
      dedupeKey: `twilio:${result.sid}`,
      deliveryStatus: whatsappStatus,
      metadata: {
        source: 'whatsapp_booking_request_receipt',
        booking_id: booking.id,
        booking_ref: booking.ref_code,
      },
    })
  } catch (error) {
    console.error('[booking request] WhatsApp receipt failed:', error.message)
    whatsappStatus = 'failed'
  }

  return Response.json({
    ok: true,
    booking: {
      id: booking.id,
      ref_code: booking.ref_code,
      treatment: treatment.name,
      date: booking.date,
      time: booking.time_slot?.slice(0, 5),
      duration: booking.duration,
      status: 'pending',
    },
    whatsapp_status: whatsappStatus,
  })
}
