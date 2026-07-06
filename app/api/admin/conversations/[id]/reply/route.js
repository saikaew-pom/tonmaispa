import { requireAdmin } from '@/lib/require-admin'
import { appendConversationMessage } from '@/lib/conversations'
import { sendWhatsAppMessage } from '@/lib/twilio'

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
  )
}

export async function POST(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  if (!isTwilioConfigured()) {
    return Response.json({ error: 'Twilio is not configured on the server yet.' }, { status: 503 })
  }

  const { id } = await params
  const { body } = await req.json().catch(() => ({}))
  const text = String(body ?? '').trim()
  if (!text) return Response.json({ error: 'Write a reply before sending.' }, { status: 400 })
  if (text.length > 1500) return Response.json({ error: 'Please keep WhatsApp replies under 1,500 characters.' }, { status: 400 })

  const { data: thread, error: threadError } = await auth.admin
    .from('conversation_threads')
    .select('id, whatsapp_address, mode')
    .eq('id', id)
    .maybeSingle()
  if (threadError) return Response.json({ error: threadError.message }, { status: 400 })
  if (!thread) return Response.json({ error: 'Conversation not found.' }, { status: 404 })
  if (!thread.whatsapp_address) return Response.json({ error: 'This conversation has no WhatsApp number yet.' }, { status: 400 })
  if (thread.mode === 'closed') return Response.json({ error: 'This conversation is closed. Reopen it before replying.' }, { status: 400 })

  let result
  try {
    result = await sendWhatsAppMessage({ to: thread.whatsapp_address, body: text })
  } catch (err) {
    console.error('[conversation reply] WhatsApp send failed:', err.message)
    return Response.json({ error: 'Could not send the WhatsApp reply. Please try again.' }, { status: 502 })
  }

  await auth.admin
    .from('conversation_threads')
    .update({
      mode: 'human',
      assigned_staff_id: auth.session.user.id,
      updated_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
    })
    .eq('id', id)

  await appendConversationMessage(auth.admin, {
    threadId: id,
    senderType: 'staff',
    channel: 'whatsapp',
    body: text,
    twilioMessageSid: result.sid,
    dedupeKey: `twilio:${result.sid}`,
    deliveryStatus: result.status || 'queued',
    metadata: { actor_id: auth.session.user.id, actor_email: auth.session.user.email },
  })

  return Response.json({ ok: true, sid: result.sid, status: result.status || 'queued' })
}
