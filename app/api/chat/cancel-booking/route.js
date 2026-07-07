import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'
import { cancelOwnedBooking } from '@/lib/chat-booking'

const cancelSchema = z.object({
  sessionId: z.string().uuid(),
  booking_id: z.string().uuid().optional(),
  booking_ref: z.string().trim().max(20).optional(),
}).refine(v => v.booking_id || v.booking_ref, { message: 'booking_id or booking_ref is required' })

// POST /api/chat/cancel-booking — guest self-service cancel from the widget's
// booking cards. Ownership enforced server-side (same-session or verified
// customer); the guest gets an automatic email + WhatsApp receipt.
export async function POST(req) {
  // Generous limit: a guest tidying up a handful of bookings in one sitting
  // is legitimate (observed live — 5/10min blocked a real guest mid-cleanup).
  // Ownership checks are the real abuse barrier here, not the rate limit.
  const rateLimit = await checkRateLimit(req, 'chat-booking-cancel', { limit: 15, window: 600 })
  if (!rateLimit.success) return tooManyRequestsResponse()

  const parsed = cancelSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: 'Invalid cancellation request.' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: settingsRows } = await admin.from('site_content')
    .select('key, value_text').eq('page', 'settings')
  const settings = Object.fromEntries((settingsRows ?? []).map(row => [row.key, row.value_text]))

  const result = await cancelOwnedBooking(admin, {
    sessionId: parsed.data.sessionId,
    bookingId: parsed.data.booking_id,
    bookingRef: parsed.data.booking_ref,
    settings,
  })
  return Response.json(result, { status: result.ok ? 200 : (result.status ?? 400) })
}
