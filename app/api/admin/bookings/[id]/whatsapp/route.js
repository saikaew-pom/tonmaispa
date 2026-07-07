import { requireAdmin } from '@/lib/require-admin'
import { sendWhatsAppMessage, fetchMessageStatus } from '@/lib/twilio'
import { logBookingAction } from '@/lib/booking-logs'
import { appendConversationMessage } from '@/lib/conversations'

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
  )
}

function settingEnabled(value) {
  return ['true', '1', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase())
}

function messageFor(status, { refCode, treatment, date, time, whatsapp }) {
  if (status === 'confirmed') {
    return `Ton Mai Spa: Your booking ${refCode} for ${treatment} on ${date} at ${time} is confirmed. See you soon! Questions? +${whatsapp}`
  }
  return `Ton Mai Spa: Your booking ${refCode} for ${treatment} on ${date} at ${time} has been cancelled. To rebook, message us: +${whatsapp}`
}

// POST /api/admin/bookings/[id]/whatsapp — staff-triggered WhatsApp update,
// gated behind settings.twilio_whatsapp_enabled AND real Twilio credentials
// being configured — same human-in-the-loop pattern as the email notify
// route, just a different channel.
export async function POST(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
  const bodyJson = await req.json().catch(() => ({}))
  const conversationId = String(bodyJson?.conversationId || bodyJson?.conversation_id || '').trim()

  const { data: settingsRows } = await auth.admin
    .from('site_content').select('key, value_text').eq('key', 'settings.twilio_whatsapp_enabled')
  const enabled = settingEnabled(settingsRows?.[0]?.value_text)
  if (!enabled) return Response.json({ error: 'WhatsApp sending is turned off in Settings.' }, { status: 503 })
  if (!isTwilioConfigured()) return Response.json({ error: 'Twilio is not configured on the server yet.' }, { status: 503 })

  const { id } = params
  const { data: booking } = await auth.admin
    .from('bookings')
    .select('ref_code, guest_name, guest_phone, date, time_slot, status, spa_treatments(name)')
    .eq('id', id)
    .maybeSingle()

  if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })
  if (!booking.guest_phone) return Response.json({ error: 'This booking has no guest phone on file.' }, { status: 400 })
  if (!['confirmed', 'cancelled'].includes(booking.status)) {
    return Response.json({ error: `No update message defined for status "${booking.status}".` }, { status: 400 })
  }

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66822866058'
  const body = messageFor(booking.status, {
    refCode: booking.ref_code,
    treatment: booking.spa_treatments?.name ?? 'Spa Treatment',
    date: booking.date,
    time: booking.time_slot?.slice(0, 5),
    whatsapp: whatsappNumber,
  })

  // Business-initiated WhatsApp messages are only deliverable as freeform text
  // inside the guest's 24-hour session window. Outside it, WhatsApp requires a
  // pre-approved Content Template — if one is configured, use it; otherwise
  // fall back to freeform and VERIFY delivery below instead of assuming it.
  const contentSid = (booking.status === 'confirmed'
    ? process.env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED
    : process.env.TWILIO_CONTENT_SID_BOOKING_CANCELLED)?.trim()

  let result
  try {
    result = await sendWhatsAppMessage({
      to: booking.guest_phone,
      ...(contentSid
        ? {
            contentSid,
            contentVariables: {
              1: booking.ref_code,
              2: booking.spa_treatments?.name ?? 'Spa Treatment',
              3: booking.date,
              4: booking.time_slot?.slice(0, 5) ?? '',
            },
          }
        : { body }),
    })
  } catch (err) {
    console.error('[bookings whatsapp] send failed:', err.message)
    return Response.json({ error: 'Could not send the WhatsApp message. Please try again.' }, { status: 502 })
  }

  // Twilio accepting the message is NOT delivery. Poll the real status once —
  // failures (esp. 63016 "outside the 24h window") show up within seconds, and
  // staff must see them instead of a false "sent". Observed live: every send
  // stuck at "queued" forever while the dashboard claimed success.
  let delivery = null
  try {
    await new Promise(r => setTimeout(r, 2500))
    delivery = await fetchMessageStatus(result.sid)
  } catch (err) {
    console.error('[bookings whatsapp] status check failed:', err.message)
  }

  if (delivery && ['failed', 'undelivered'].includes(delivery.status)) {
    const outsideWindow = String(delivery.errorCode) === '63016'
    await logBookingAction(auth.admin, {
      bookingId: id,
      actorEmail: auth.session.user.email,
      action: 'whatsapp_failed',
      detail: `WhatsApp to ${booking.guest_phone} not delivered (Twilio ${delivery.errorCode ?? 'unknown'}: ${delivery.errorMessage ?? delivery.status})`,
    })
    return Response.json({
      error: outsideWindow
        ? 'WhatsApp rejected the message: the guest has not messaged the spa in the last 24 hours, so WhatsApp only allows an approved template. Ask the guest to message the spa WhatsApp first, or configure a Twilio Content Template (TWILIO_CONTENT_SID_BOOKING_CONFIRMED / _CANCELLED).'
        : `WhatsApp message was not delivered (Twilio error ${delivery.errorCode ?? delivery.status}). ${delivery.errorMessage ?? ''}`.trim(),
      delivery,
    }, { status: 502 })
  }

  const sentAt = new Date().toISOString()
  await auth.admin.from('bookings').update({ last_whatsapp_sent_at: sentAt, last_whatsapp_status: booking.status }).eq('id', id)

  await logBookingAction(auth.admin, {
    bookingId: id,
    actorEmail: auth.session.user.email,
    action: 'whatsapp_sent',
    detail: `${booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled'} WhatsApp message sent to ${booking.guest_phone}`,
  })

  if (conversationId) {
    const { data: thread } = await auth.admin
      .from('conversation_threads')
      .select('id, whatsapp_address')
      .eq('id', conversationId)
      .maybeSingle()

    if (thread?.whatsapp_address) {
      await appendConversationMessage(auth.admin, {
        threadId: thread.id,
        senderType: 'staff',
        channel: 'whatsapp',
        body,
        twilioMessageSid: result.sid,
        dedupeKey: `twilio:${result.sid}`,
        deliveryStatus: result.status || 'queued',
        metadata: {
          actor_id: auth.session.user.id,
          actor_email: auth.session.user.email,
          booking_ref: booking.ref_code,
          booking_status: booking.status,
          source: 'booking_confirmation',
        },
      })
    }
  }

  return Response.json({ ok: true, sid: result.sid, last_whatsapp_sent_at: sentAt, last_whatsapp_status: booking.status })
}
