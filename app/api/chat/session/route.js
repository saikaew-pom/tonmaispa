// ============================================================
// TON MAI SPA — /api/chat/session
// Restore a chat session's own history on load.
// Runs server-side with the admin client so the browser never
// queries chat_sessions directly (RLS has no public policies).
// ============================================================

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { listSessionBookings } from '@/lib/chat-booking'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req) {
  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!UUID_PATTERN.test(sessionId ?? '')) {
    return Response.json({ error: 'Invalid sessionId' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('chat_sessions')
    .select('messages, guest_name, guest_phone, last_active, metadata')
    .eq('session_id', sessionId)
    .single()

  // Rebuild the booking-lookup card on restore. Two states, sibling to the
  // booking_draft/reschedule_draft restore already handled client-side:
  //  - verified and still within the access window → fetch bookings FRESH
  //    (never trust a stale snapshot from a much earlier turn) and hand back
  //    an already_verified card, same shape find_my_bookings/start_booking_lookup
  //    return live.
  //  - not verified but a lookup was started → hand back the empty
  //    "please verify" card. (A page reload — or a mobile tab discarded and
  //    reloaded by the OS — otherwise wipes this ephemeral UI state while the
  //    bot's own "please verify"/"you're verified" text stays in history.)
  let bookingLookup = null
  const access = data?.metadata?.booking_access
  if (access?.customer_id && access.expires_at && Date.parse(access.expires_at) > Date.now()) {
    const existing = await listSessionBookings(admin, sessionId)
    bookingLookup = { ok: true, lookup_ready: true, already_verified: true, bookings: existing.bookings ?? [] }
  } else if (data?.metadata?.booking_lookup_pending) {
    bookingLookup = { ok: true, lookup_ready: true, message: 'Secure booking lookup is ready. Enter your phone and email to verify.' }
  }

  return Response.json({ session: data ?? null, bookingLookup })
}

export async function DELETE(req) {
  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!UUID_PATTERN.test(sessionId ?? '')) {
    return Response.json({ error: 'Invalid sessionId' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const [{ error }, { error: threadError }] = await Promise.all([
    admin.from('chat_sessions').delete().eq('session_id', sessionId),
    // Messages and pending reply jobs are removed by the thread's cascade.
    admin.from('conversation_threads').delete().eq('web_session_id', sessionId),
  ])

  if (error || threadError) return Response.json({ error: 'Unable to clear conversation' }, { status: 500 })
  return Response.json({ ok: true })
}
