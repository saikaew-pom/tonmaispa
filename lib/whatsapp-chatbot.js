import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getMiniMax, MINIMAX_MODEL } from '@/lib/minimax'
import { buildSystemPrompt } from '@/lib/chatbot'
import { prepareModelMessages } from '@/lib/chat-history'
import { sendWhatsAppMessage } from '@/lib/twilio'
import {
  appendConversationMessage,
  claimReplyJob,
  finishReplyJob,
  getRecentConversationMessages,
} from '@/lib/conversations'

const RATE_LIMIT_MESSAGES = 30
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

function textFromResponse(response) {
  return (response?.content ?? [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim()
}

async function featureIsEnabled(admin) {
  const { data } = await admin
    .from('site_content')
    .select('value_text')
    .eq('key', 'settings.whatsapp_chatbot_enabled')
    .maybeSingle()
  return data?.value_text === 'true'
}

async function isOverRateLimit(admin, threadId) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count } = await admin
    .from('conversation_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .eq('sender_type', 'customer')
    .gte('created_at', since)
  return (count ?? 0) > RATE_LIMIT_MESSAGES
}

async function buildReply(admin, thread) {
  const [treatmentsRes, settingsRes, recentMessages] = await Promise.all([
    admin.from('spa_treatments').select('*').eq('is_active', true).order('sort_order'),
    admin.from('site_content').select('key, value_text').eq('page', 'settings'),
    getRecentConversationMessages(admin, thread.id),
  ])

  const settings = Object.fromEntries((settingsRes.data ?? []).map(row => [row.key, row.value_text]))
  const system = buildSystemPrompt({
    treatments: treatmentsRes.data ?? [],
    settings,
    bookingEngineEnabled: false,
    channel: 'whatsapp',
  })

  const client = getMiniMax()
  if (!client) throw new Error('AI service unavailable')

  const response = await client.messages.create({
    model: MINIMAX_MODEL,
    max_tokens: 300,
    system,
    messages: prepareModelMessages(recentMessages),
  })
  const reply = textFromResponse(response)
  if (!reply) throw new Error('AI returned an empty response')
  return { reply: reply.slice(0, 1500), source: 'ai' }
}

export async function processWhatsAppReply({ messageSid, threadId, fromAddress, body }) {
  const admin = createSupabaseAdminClient()
  const job = await claimReplyJob(admin, messageSid)
  if (!job) return

  try {
    if (!await featureIsEnabled(admin)) {
      await finishReplyJob(admin, messageSid, 'skipped', 'WhatsApp chatbot is disabled')
      return
    }

    const { data: thread, error: threadError } = await admin
      .from('conversation_threads')
      .select('*')
      .eq('id', threadId)
      .single()
    if (threadError) throw threadError

    // Human ownership always wins. The bot must remain silent while a staff
    // member owns the conversation or the thread is waiting in their queue.
    if (thread.mode !== 'bot') {
      await finishReplyJob(admin, messageSid, 'skipped', `Thread mode is ${thread.mode}`)
      return
    }

    if (!body?.trim()) {
      await finishReplyJob(admin, messageSid, 'skipped', 'No text body to answer')
      return
    }

    if (await isOverRateLimit(admin, thread.id)) {
      await finishReplyJob(admin, messageSid, 'skipped', 'Inbound rate limit exceeded')
      return
    }

    let generated
    try {
      generated = await buildReply(admin, thread)
    } catch (aiError) {
      console.error('[whatsapp-chatbot] reply generation failed:', aiError)
      generated = {
        reply: "Thank you for messaging Ton Mai Spa. I'm having trouble replying just now, but our team can continue helping you here shortly.",
        source: 'fallback',
      }
    }

    const result = await sendWhatsAppMessage({ to: fromAddress, body: generated.reply })
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'bot',
      channel: 'whatsapp',
      body: generated.reply,
      twilioMessageSid: result.sid,
      dedupeKey: `twilio:${result.sid}`,
      deliveryStatus: result.status || 'queued',
      metadata: { reply_to_sid: messageSid, reply_source: generated.source },
    })

    await finishReplyJob(admin, messageSid, 'completed')
  } catch (error) {
    console.error('[whatsapp-chatbot] processing failed:', error)
    await finishReplyJob(admin, messageSid, 'failed', error.message)
  }
}
