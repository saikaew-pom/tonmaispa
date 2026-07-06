import { requireAdmin } from '@/lib/require-admin'
import { sendEmail, bookingConfirmedHtml, bookingCancelledHtml } from '@/lib/brevo'
import { logBookingAction } from '@/lib/booking-logs'

// POST /api/admin/bookings/[id]/notify — staff-triggered email to the guest
// reflecting the booking's CURRENT status. Nothing sends automatically on a
// status change; staff reviews the booking, then explicitly clicks "Send
// update email" so the guest is only ever notified once someone actually
// looked at it (human-in-the-loop, matching how status changes are made).
export async function POST(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params

  const { data: booking } = await auth.admin
    .from('bookings')
    .select('ref_code, guest_name, guest_email, date, time_slot, status, spa_treatments(name)')
    .eq('id', id)
    .maybeSingle()

  if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })
  if (!booking.guest_email) return Response.json({ error: 'This booking has no guest email on file.' }, { status: 400 })
  if (!['confirmed', 'cancelled'].includes(booking.status)) {
    return Response.json({ error: `No update email defined for status "${booking.status}".` }, { status: 400 })
  }

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66822866058'
  const templateArgs = {
    name:      booking.guest_name,
    refCode:   booking.ref_code,
    date:      booking.date,
    time:      booking.time_slot?.slice(0, 5),
    treatment: booking.spa_treatments?.name ?? 'Spa Treatment',
    whatsapp,
  }

  const isConfirmed = booking.status === 'confirmed'
  const result = await sendEmail({
    to:      booking.guest_email,
    subject: isConfirmed
      ? `Booking Confirmed — ${booking.ref_code} — Ton Mai Spa`
      : `Booking Cancelled — ${booking.ref_code} — Ton Mai Spa`,
    html: isConfirmed ? bookingConfirmedHtml(templateArgs) : bookingCancelledHtml(templateArgs),
  })

  if (!result.ok) return Response.json({ error: 'Could not send the email. Please try again.' }, { status: 502 })

  const sentAt = new Date().toISOString()
  await auth.admin.from('bookings').update({
    last_email_sent_at: sentAt,
    last_email_status: booking.status,
  }).eq('id', id)

  await logBookingAction(auth.admin, {
    bookingId: id,
    actorEmail: auth.session.user.email,
    action: 'email_sent',
    detail: `${isConfirmed ? 'Confirmed' : 'Cancelled'} email sent to ${booking.guest_email}`,
  })

  return Response.json({ ok: true, last_email_sent_at: sentAt, last_email_status: booking.status })
}
