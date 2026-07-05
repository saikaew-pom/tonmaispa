// Shared audit-trail writer for the bookings dashboard — every edit, status
// change, and notification send goes through here so "View logs" always has
// a complete picture of who did what and when. Never throws: a logging
// failure must never block the actual booking action from succeeding.
export async function logBookingAction(admin, { bookingId, actorEmail, action, detail }) {
  const { error } = await admin.from('booking_logs').insert({
    booking_id: bookingId,
    actor_email: actorEmail || null,
    action,
    detail: detail || null,
  })
  if (error) console.error('[booking-logs] failed to write log entry:', error.message)
}
