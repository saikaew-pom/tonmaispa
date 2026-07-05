// ============================================================
// TON MAI SPA — /api/chat/session
// Restore a chat session's own history on load.
// Runs server-side with the admin client so the browser never
// queries chat_sessions directly (RLS has no public policies).
// ============================================================

import { createSupabaseAdminClient } from '@/lib/supabase-admin'

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

  return Response.json({ session: data ?? null })
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
