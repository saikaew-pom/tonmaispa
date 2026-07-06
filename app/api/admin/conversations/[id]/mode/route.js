import { requireAdmin } from '@/lib/require-admin'
import { appendConversationMessage } from '@/lib/conversations'

const VALID_MODES = new Set(['bot', 'waiting_for_staff', 'human', 'closed'])

function systemText(mode, email) {
  if (mode === 'bot') return `Bot resumed by ${email}.`
  if (mode === 'waiting_for_staff') return `Marked as needing staff by ${email}.`
  if (mode === 'human') return `Staff takeover started by ${email}. Bot replies are paused.`
  return `Conversation closed by ${email}.`
}

export async function POST(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { mode } = await req.json().catch(() => ({}))
  if (!VALID_MODES.has(mode)) {
    return Response.json({ error: 'Choose a valid conversation mode.' }, { status: 400 })
  }

  const updates = {
    mode,
    assigned_staff_id: mode === 'bot' ? null : auth.session.user.id,
    updated_at: new Date().toISOString(),
    ...(mode === 'closed' ? { closed_at: new Date().toISOString() } : { closed_at: null }),
  }

  const { data: thread, error } = await auth.admin
    .from('conversation_threads')
    .update(updates)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  if (!thread) return Response.json({ error: 'Conversation not found.' }, { status: 404 })

  await appendConversationMessage(auth.admin, {
    threadId: id,
    senderType: 'system',
    channel: 'web',
    body: systemText(mode, auth.session.user.email),
    dedupeKey: `system:${id}:${mode}:${Date.now()}`,
    metadata: { mode, actor_id: auth.session.user.id, actor_email: auth.session.user.email },
  })

  return Response.json({ ok: true, mode })
}
