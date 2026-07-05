import { after } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { emptyTwimlResponse, parseAndValidateTwilioWebhook } from '@/lib/twilio'
import {
  appendConversationMessage,
  createReplyJob,
  getOrCreateWhatsAppThread,
} from '@/lib/conversations'
import { processWhatsAppReply } from '@/lib/whatsapp-chatbot'

export const runtime = 'nodejs'
export const maxDuration = 60

function collectMedia(params) {
  const count = Number.parseInt(params.NumMedia || '0', 10)
  if (!Number.isFinite(count) || count <= 0) return []

  return Array.from({ length: Math.min(count, 10) }, (_, index) => ({
    url: params[`MediaUrl${index}`] || null,
    content_type: params[`MediaContentType${index}`] || null,
  })).filter(item => item.url)
}

export async function POST(request) {
  const webhook = await parseAndValidateTwilioWebhook(request)
  if (!webhook.valid) {
    return Response.json({ error: webhook.error }, { status: webhook.status })
  }

  const params = webhook.params
  const messageSid = params.MessageSid
  if (!messageSid || !params.From || !params.To) {
    return Response.json({ error: 'Incomplete Twilio message webhook' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const eventKey = `inbound:${messageSid}`

  const { error: eventError } = await admin.from('twilio_webhook_events').insert({
    event_key: eventKey,
    event_type: 'whatsapp_inbound',
    twilio_sid: messageSid,
    payload: params,
    processing_status: 'received',
  })

  if (eventError && eventError.code !== '23505') {
    console.error('[twilio/inbound] failed to store webhook event:', eventError.message)
    return Response.json({ error: 'Could not record webhook' }, { status: 500 })
  }

  const { error: messageError } = await admin.from('twilio_messages').upsert({
    twilio_message_sid: messageSid,
    direction: 'inbound',
    from_address: params.From,
    to_address: params.To,
    body: params.Body || null,
    media: collectMedia(params),
    status: 'received',
    raw_payload: params,
  }, { onConflict: 'twilio_message_sid', ignoreDuplicates: true })

  if (messageError && messageError.code !== '23505') {
    await admin.from('twilio_webhook_events')
      .update({ processing_status: 'failed', processing_error: messageError.message })
      .eq('event_key', eventKey)
    console.error('[twilio/inbound] failed to store message:', messageError.message)
    return Response.json({ error: 'Could not record message' }, { status: 500 })
  }

  let thread
  try {
    thread = await getOrCreateWhatsAppThread(admin, params.From)
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'customer',
      channel: 'whatsapp',
      body: params.Body || null,
      twilioMessageSid: messageSid,
      dedupeKey: `twilio:${messageSid}`,
      deliveryStatus: 'received',
      metadata: { media: collectMedia(params) },
    })
    await createReplyJob(admin, { threadId: thread.id, messageSid })
  } catch (conversationError) {
    await admin.from('twilio_webhook_events')
      .update({ processing_status: 'failed', processing_error: conversationError.message })
      .eq('event_key', eventKey)
    console.error('[twilio/inbound] failed to build conversation timeline:', conversationError)
    return Response.json({ error: 'Could not record conversation' }, { status: 500 })
  }

  await admin.from('twilio_webhook_events')
    .update({ processing_status: 'stored', processed_at: new Date().toISOString() })
    .eq('event_key', eventKey)

  // Twilio receives its acknowledgement immediately. The durable reply job is
  // claimed after the response, so webhook retries cannot create two replies.
  after(() => processWhatsAppReply({
    messageSid,
    threadId: thread.id,
    fromAddress: params.From,
    body: params.Body || '',
  }))

  return emptyTwimlResponse()
}
