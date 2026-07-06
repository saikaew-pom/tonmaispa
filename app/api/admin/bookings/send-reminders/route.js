import { requireAdmin } from '@/lib/require-admin'
import { sendWhatsAppMessage } from '@/lib/twilio'
import { appendConversationMessage, getOrCreateWhatsAppThread } from '@/lib/conversations'
import { logBookingAction } from '@/lib/booking-logs'

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

function bangkokYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function reminderMessage({ refCode, treatment, date, time, whatsapp }) {
  return `Ton Mai Spa reminder: Your booking ${refCode} for ${treatment} is tomorrow (${date}) at ${time}. We look forward to seeing you. Questions? +${whatsapp}`
}

// POST /api/admin/bookings/send-reminders — staff-triggered first version.
// Sends tomorrow's WhatsApp reminders once per booking. Later this can be
// called by Vercel Cron after the workflow is proven.
export async function POST() {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data: settingsRows } = await auth.admin
    .from('site_content')
    .select('key, value_text')
    .eq('key', 'settings.twilio_whatsapp_enabled')
  const enabled = settingEnabled(settingsRows?.[0]?.value_text)
  if (!enabled) return Response.json({ error: 'WhatsApp sending is turned off in Settings.' }, { status: 503 })
  if (!isTwilioConfigured()) return Response.json({ error: 'Twilio is not configured on the server yet.' }, { status: 503 })

  const targetDate = bangkokYmd(addDays(new Date(), 1))
  const { data: bookings, error } = await auth.admin
    .from('bookings')
    .select('id, ref_code, guest_name, guest_phone, date, time_slot, duration, status, whatsapp_reminder_sent_at, spa_treatments(name)')
    .eq('date', targetDate)
    .eq('status', 'confirmed')
    .is('whatsapp_reminder_sent_at', null)
    .order('time_slot', { ascending: true })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 400 })

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66631175211'
  const sent = []
  const skipped = []
  const failed = []

  for (const booking of bookings ?? []) {
    if (!booking.guest_phone) {
      skipped.push({ id: booking.id, ref_code: booking.ref_code, reason: 'No guest phone' })
      continue
    }

    const body = reminderMessage({
      refCode: booking.ref_code,
      treatment: booking.spa_treatments?.name ?? 'Spa Treatment',
      date: booking.date,
      time: booking.time_slot?.slice(0, 5),
      whatsapp: whatsappNumber,
    })

    try {
      const result = await sendWhatsAppMessage({ to: booking.guest_phone, body })
      const sentAt = new Date().toISOString()
      await auth.admin
        .from('bookings')
        .update({ whatsapp_reminder_sent_at: sentAt, whatsapp_reminder_status: result.status || 'queued' })
        .eq('id', booking.id)

      await logBookingAction(auth.admin, {
        bookingId: booking.id,
        actorEmail: auth.session.user.email,
        action: 'whatsapp_reminder_sent',
        detail: `Reminder WhatsApp sent to ${booking.guest_phone}`,
      })

      try {
        const thread = await getOrCreateWhatsAppThread(auth.admin, booking.guest_phone)
        await appendConversationMessage(auth.admin, {
          threadId: thread.id,
          senderType: 'system',
          channel: 'whatsapp',
          body,
          twilioMessageSid: result.sid,
          dedupeKey: `twilio:${result.sid}`,
          deliveryStatus: result.status || 'queued',
          metadata: {
            actor_id: auth.session.user.id,
            actor_email: auth.session.user.email,
            booking_ref: booking.ref_code,
            source: 'booking_reminder',
          },
        })
      } catch (timelineError) {
        console.error('[booking reminders] timeline append failed:', timelineError.message)
      }

      sent.push({ id: booking.id, ref_code: booking.ref_code, sent_at: sentAt, status: result.status || 'queued' })
    } catch (err) {
      failed.push({ id: booking.id, ref_code: booking.ref_code, error: err.message || 'Could not send reminder' })
      await auth.admin
        .from('bookings')
        .update({ whatsapp_reminder_status: 'failed' })
        .eq('id', booking.id)
    }
  }

  return Response.json({
    ok: true,
    target_date: targetDate,
    checked: bookings?.length ?? 0,
    sent,
    skipped,
    failed,
  })
}

