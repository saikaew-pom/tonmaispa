// ============================================================
// TON MAI SPA — /api/chat/phone-lookup
// Cross-device chat history match. Runs server-side with the
// admin client so a guest's phone number + conversation is never
// exposed to the public anon key — only the current device's own
// session (matched to the same guest) gets the merged history back.
// ============================================================

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'

export async function POST(req) {
  // Cheap guard against phone-number brute forcing
  const rl = await checkRateLimit(req, 'chat-phone-lookup', { limit: 10, window: 600 })
  if (!rl.success) return tooManyRequestsResponse()

  const { phone, currentSessionId } = await req.json()
  if (!phone || !currentSessionId) {
    return Response.json({ error: 'Missing phone or currentSessionId' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  const { data: prior } = await admin
    .from('chat_sessions')
    .select('session_id, messages, guest_name, last_active, metadata')
    .eq('guest_phone', phone)
    .neq('session_id', currentSessionId)
    .order('last_active', { ascending: false })
    .limit(1)
    .single()

  if (!prior?.messages?.length) {
    return Response.json({ matched: false })
  }

  const mergedMessages = [
    ...prior.messages,
    {
      role:      'assistant',
      content:   `Welcome back${prior.guest_name ? `, ${prior.guest_name}` : ''}! I found your previous conversation. ${prior.metadata?.interests?.[0] ? `Last time you were interested in ${prior.metadata.interests[0]}. ` : ''}How can I help you today?`,
      timestamp: new Date().toISOString(),
      isReturn:  true,
    },
  ]

  await admin.from('chat_sessions').upsert({
    session_id:  currentSessionId,
    messages:    mergedMessages,
    guest_name:  prior.guest_name,
    guest_phone: phone,
    last_active: new Date().toISOString(),
  }, { onConflict: 'session_id' })

  return Response.json({ matched: true, messages: mergedMessages, guestName: prior.guest_name })
}
