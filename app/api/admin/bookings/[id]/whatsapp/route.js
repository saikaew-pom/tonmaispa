import { requireAdmin } from '@/lib/require-admin'
import { sendWhatsAppMessage } from '@/lib/twilio'
import { logBookingAction } from '@/lib/booking-logs'

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
  )
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

  const { data: settingsRows } = await auth.admin
    .from('site_content').select('key, value_text').eq('key', 'settings.twilio_whatsapp_enabled')
  const enabled = settingsRows?.[0]?.value_text === 'true'
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

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66631175211'
  const body = messageFor(booking.status, {
    refCode: booking.ref_code,
    treatment: booking.spa_treatments?.name ?? 'Spa Treatment',
    date: booking.date,
    time: booking.time_slot?.slice(0, 5),
    whatsapp: whatsappNumber,
  })

  try {
    await sendWhatsAppMessage({ to: booking.guest_phone, body })
  } catch (err) {
    console.error('[bookings whatsapp] send failed:', err.message)
    return Response.json({ error: 'Could not send the WhatsApp message. Please try again.' }, { status: 502 })
  }

  const sentAt = new Date().toISOString()
  await auth.admin.from('bookings').update({ last_whatsapp_sent_at: sentAt }).eq('id', id)

  await logBookingAction(auth.admin, {
    bookingId: id,
    actorEmail: auth.session.user.email,
    action: 'whatsapp_sent',
    detail: `${booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled'} WhatsApp message sent to ${booking.guest_phone}`,
  })

  return Response.json({ ok: true, last_whatsapp_sent_at: sentAt })
}
