import { requireAdmin } from '@/lib/require-admin'
import { appendConversationMessage } from '@/lib/conversations'
import { sendWhatsAppMessage } from '@/lib/twilio'

const VALID_MODES = new Set(['bot', 'waiting_for_staff', 'human', 'closed'])

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
  )
}

function systemText(mode, email) {
  if (mode === 'bot') return `Bot resumed by ${email}.`
  if (mode === 'waiting_for_staff') return `Marked as needing staff by ${email}.`
  if (mode === 'human') return `Staff takeover started by ${email}. Bot replies are paused.`
  return `Conversation closed by ${email}.`
}

function customerNotice(mode) {
  if (mode === 'human') {
    return 'A Ton Mai Spa team member is now helping you here. The chatbot is paused.'
  }
  if (mode === 'bot') {
    return 'Our assistant is back online and can help with general questions. A team member can still join again if needed.'
  }
  if (mode === 'closed') {
    return 'Thank you for chatting with Ton Mai Spa. This conversation is now closed, but you can message us again anytime.'
  }
  if (mode === 'waiting_for_staff') {
    return 'Thanks — your message is waiting for the Ton Mai Spa team. A team member will help you here as soon as possible.'
  }
  return null
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
    .select('id, whatsapp_address')
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

  const notice = customerNotice(mode)
  let noticeStatus = 'not_applicable'
  if (notice && thread.whatsapp_address && isTwilioConfigured()) {
    try {
      const result = await sendWhatsAppMessage({ to: thread.whatsapp_address, body: notice })
      await appendConversationMessage(auth.admin, {
        threadId: id,
        senderType: 'system',
        channel: 'whatsapp',
        body: notice,
        twilioMessageSid: result.sid,
        dedupeKey: `twilio:${result.sid}`,
        deliveryStatus: result.status || 'queued',
        metadata: {
          mode,
          mode_notice: true,
          actor_id: auth.session.user.id,
          actor_email: auth.session.user.email,
        },
      })
      noticeStatus = 'sent'
    } catch (err) {
      console.error('[conversation mode] WhatsApp mode notice failed:', err.message)
      noticeStatus = 'failed'
      await appendConversationMessage(auth.admin, {
        threadId: id,
        senderType: 'system',
        channel: 'web',
        body: `Could not send WhatsApp mode notice: ${err.message}`,
        dedupeKey: `system:${id}:${mode}:notice-failed:${Date.now()}`,
        metadata: { mode, mode_notice_failed: true },
      })
    }
  } else if (notice && thread.whatsapp_address && !isTwilioConfigured()) {
    noticeStatus = 'twilio_not_configured'
  }

  return Response.json({ ok: true, mode, notice_status: noticeStatus })
}
