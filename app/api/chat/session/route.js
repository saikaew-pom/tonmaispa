// ============================================================
// TON MAI SPA — /api/chat/session
// Restore a chat session's own history on load.
// Runs server-side with the admin client so the browser never
// queries chat_sessions directly (RLS has no public policies).
// ============================================================

import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) return Response.json({ error: 'Missing sessionId' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('chat_sessions')
    .select('messages, guest_name, guest_phone, last_active, metadata')
    .eq('session_id', sessionId)
    .single()

  return Response.json({ session: data ?? null })
}
