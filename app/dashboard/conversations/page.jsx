import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import ConversationsClient from './ConversationsClient'

export const dynamic = 'force-dynamic'

function threadNeedsReply(thread) {
  if (thread.mode === 'closed') return false
  if (thread.mode === 'waiting_for_staff') return true
  if (!thread.last_inbound_at) return false
  if (!thread.last_outbound_at) return true
  return new Date(thread.last_inbound_at).getTime() > new Date(thread.last_outbound_at).getTime()
}

async function getThreads(selectedId) {
  const admin = createSupabaseAdminClient()

  const { data: threads } = await admin
    .from('conversation_threads')
    .select(`
      id,
      channel,
      mode,
      web_session_id,
      whatsapp_address,
      assigned_staff_id,
      metadata,
      created_at,
      updated_at,
      last_active_at,
      last_inbound_at,
      last_outbound_at,
      closed_at,
      customers:customer_id (
        id,
        display_name,
        primary_phone_e164,
        email
      ),
      profiles:assigned_staff_id (
        full_name
      )
    `)
    .order('last_active_at', { ascending: false })
    .limit(80)

  const list = (threads ?? []).sort((a, b) => {
    const aAttention = threadNeedsReply(a)
    const bAttention = threadNeedsReply(b)
    if (aAttention !== bAttention) return aAttention ? -1 : 1
    return new Date(b.last_active_at || 0).getTime() - new Date(a.last_active_at || 0).getTime()
  })
  const activeId = selectedId || list[0]?.id || null

  let messages = []
  if (activeId) {
    const { data } = await admin
      .from('conversation_messages')
      .select('id, sender_type, channel, body, delivery_status, metadata, created_at, delivered_at, read_at')
      .eq('thread_id', activeId)
      .order('created_at', { ascending: true })
      .limit(250)
    messages = data ?? []
  }

  return { threads: list, activeId, messages }
}

export default async function ConversationsPage({ searchParams }) {
  const params = await searchParams
  const selectedId = params?.thread || null
  const { threads, activeId, messages } = await getThreads(selectedId)

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <p style={{ margin: '0 0 6px', font: '600 11px Inter,sans-serif', letterSpacing: 1.8, color: '#C4924A', textTransform: 'uppercase' }}>Shared inbox</p>
        <h1 style={{ font: '400 34px Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>Conversations</h1>
        <p style={{ margin: '8px 0 0', maxWidth: 760, font: '400 13px/1.7 Inter,sans-serif', color: '#6B6663' }}>
          See web and WhatsApp chats in one place. Take over when a guest needs a human, then return the thread to the bot when finished.
        </p>
      </div>
      <ConversationsClient initialThreads={threads} activeId={activeId} initialMessages={messages} />
    </div>
  )
}
