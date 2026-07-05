import { createHash } from 'node:crypto'
import { normalizeWhatsAppAddress } from '@/lib/twilio'

const RECENT_MESSAGE_LIMIT = 14

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20)
}

async function findCustomerIdByWhatsApp(admin, address) {
  const phone = normalizeWhatsAppAddress(address).replace(/^whatsapp:/, '')
  const { data } = await admin
    .from('customers')
    .select('id')
    .eq('primary_phone_e164', phone)
    .maybeSingle()
  return data?.id ?? null
}

export async function getOrCreateWebThread(admin, sessionId, customerId = null) {
  const { data: existing } = await admin
    .from('conversation_threads')
    .select('*')
    .eq('web_session_id', sessionId)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await admin
    .from('conversation_threads')
    .insert({ web_session_id: sessionId, customer_id: customerId, channel: 'web' })
    .select('*')
    .single()

  if (!error) return data
  if (error.code !== '23505') throw error

  const { data: raced, error: racedError } = await admin
    .from('conversation_threads')
    .select('*')
    .eq('web_session_id', sessionId)
    .single()
  if (racedError) throw racedError
  return raced
}

export async function getOrCreateWhatsAppThread(admin, address) {
  const whatsappAddress = normalizeWhatsAppAddress(address)
  const { data: existing } = await admin
    .from('conversation_threads')
    .select('*')
    .eq('whatsapp_address', whatsappAddress)
    .maybeSingle()

  const customerId = existing?.customer_id ?? await findCustomerIdByWhatsApp(admin, whatsappAddress)
  if (existing) {
    if (customerId && !existing.customer_id) {
      await admin.from('conversation_threads').update({ customer_id: customerId }).eq('id', existing.id)
      return { ...existing, customer_id: customerId }
    }
    return existing
  }

  const { data, error } = await admin
    .from('conversation_threads')
    .insert({ whatsapp_address: whatsappAddress, customer_id: customerId, channel: 'whatsapp' })
    .select('*')
    .single()

  if (!error) return data
  if (error.code !== '23505') throw error

  const { data: raced, error: racedError } = await admin
    .from('conversation_threads')
    .select('*')
    .eq('whatsapp_address', whatsappAddress)
    .single()
  if (racedError) throw racedError
  return raced
}

export async function appendConversationMessage(admin, message) {
  const now = new Date().toISOString()
  const row = {
    thread_id: message.threadId,
    sender_type: message.senderType,
    channel: message.channel,
    body: message.body || null,
    twilio_message_sid: message.twilioMessageSid || null,
    dedupe_key: message.dedupeKey,
    delivery_status: message.deliveryStatus || null,
    metadata: message.metadata || {},
    created_at: message.createdAt || now,
  }

  const { data, error } = await admin
    .from('conversation_messages')
    .upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('*')
    .maybeSingle()
  if (error) throw error

  const inbound = message.senderType === 'customer'
  const updates = {
    updated_at: now,
    last_active_at: now,
    ...(inbound ? { last_inbound_at: now } : { last_outbound_at: now }),
  }
  await admin.from('conversation_threads').update(updates).eq('id', message.threadId)
  return data
}

export async function recordWebExchange(admin, { sessionId, customerId, messages, assistantText }) {
  const thread = await getOrCreateWebThread(admin, sessionId, customerId)
  const lastUserIndex = messages.map(message => message?.role).lastIndexOf('user')
  const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : null
  const turnKey = `${sessionId}:${messages.length}:${digest(lastUser?.content || '')}`

  if (lastUser?.content) {
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'customer',
      channel: 'web',
      body: String(lastUser.content).slice(0, 4000),
      dedupeKey: `web:${turnKey}:customer`,
      createdAt: lastUser.timestamp,
    })
  }

  if (assistantText?.trim()) {
    await appendConversationMessage(admin, {
      threadId: thread.id,
      senderType: 'bot',
      channel: 'web',
      body: assistantText.trim().slice(0, 4000),
      dedupeKey: `web:${turnKey}:bot`,
    })
  }
  return thread
}

export async function getRecentConversationMessages(admin, threadId, limit = RECENT_MESSAGE_LIMIT) {
  const { data, error } = await admin
    .from('conversation_messages')
    .select('sender_type, body, created_at')
    .eq('thread_id', threadId)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  return (data ?? []).reverse().map(message => ({
    role: message.sender_type === 'customer' ? 'user' : 'assistant',
    content: message.body,
  }))
}

export async function createReplyJob(admin, { threadId, messageSid }) {
  const { data, error } = await admin
    .from('conversation_reply_jobs')
    .upsert({ thread_id: threadId, inbound_message_sid: messageSid }, {
      onConflict: 'inbound_message_sid',
      ignoreDuplicates: true,
    })
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function claimReplyJob(admin, messageSid) {
  const { data: pending, error: readError } = await admin
    .from('conversation_reply_jobs')
    .select('id, attempts')
    .eq('inbound_message_sid', messageSid)
    .eq('status', 'pending')
    .maybeSingle()
  if (readError || !pending) {
    if (readError) throw readError
    return null
  }

  const { data, error } = await admin
    .from('conversation_reply_jobs')
    .update({
      status: 'processing',
      attempts: pending.attempts + 1,
      started_at: new Date().toISOString(),
    })
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function finishReplyJob(admin, messageSid, status, errorMessage = null) {
  await admin
    .from('conversation_reply_jobs')
    .update({
      status,
      error_message: errorMessage?.slice(0, 1000) || null,
      completed_at: new Date().toISOString(),
    })
    .eq('inbound_message_sid', messageSid)
}

export function conversationDedupeKey(prefix, value) {
  return `${prefix}:${digest(value)}`
}
