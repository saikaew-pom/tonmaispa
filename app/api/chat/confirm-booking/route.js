import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'
import { confirmBookingDraft } from '@/lib/chat-booking'

const confirmationSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().uuid(),
  // Composed client-side from an explicit country-code selector + local
  // number, and a required email — collected in the review card right
  // before this request, never trusted from AI-parsed chat text.
  guest_phone: z.string().trim().min(7).max(20),
  guest_email: z.string().trim().min(3).max(200),
})

export async function POST(req) {
  const rateLimit = await checkRateLimit(req, 'chat-booking-confirm', { limit: 5, window: 600 })
  if (!rateLimit.success) return tooManyRequestsResponse()

  const parsed = confirmationSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: 'Invalid booking confirmation.' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: settingsRows } = await admin.from('site_content')
    .select('key, value_text').eq('page', 'settings')
  const settings = Object.fromEntries((settingsRows ?? []).map(row => [row.key, row.value_text]))
  const fullBookingEnabled = settings['settings.booking_engine_enabled'] === 'true'
    && settings['settings.chatbot_booking_mode'] === 'full'

  if (!fullBookingEnabled) {
    return Response.json({ error: 'Chat booking is not currently available.' }, { status: 503 })
  }

  const result = await confirmBookingDraft(admin, { ...parsed.data, settings })
  return Response.json(result, { status: result.ok ? 200 : (result.status ?? 400) })
}
