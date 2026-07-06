'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MODE_LABELS = {
  bot: 'Bot active',
  waiting_for_staff: 'Needs staff',
  human: 'Staff active',
  closed: 'Closed',
}

const MODE_COLORS = {
  bot: '#3B5249',
  waiting_for_staff: '#C4924A',
  human: '#7B4B2A',
  closed: '#9B9390',
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'mine', label: 'My conversations' },
  { key: 'human', label: 'Staff active' },
  { key: 'bot', label: 'Bot active' },
  { key: 'closed', label: 'Closed' },
]

function guestName(thread) {
  return thread.customers?.display_name
    || thread.whatsapp_address?.replace(/^whatsapp:/, '')
    || thread.web_session_id?.slice(0, 10)
    || 'Guest'
}

function timeAgo(value) {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(value).toLocaleDateString()
}

function needsReply(thread) {
  if (thread.mode === 'closed') return false
  if (thread.mode === 'waiting_for_staff') return true
  if (!thread.last_inbound_at) return false
  if (!thread.last_outbound_at) return true
  return new Date(thread.last_inbound_at).getTime() > new Date(thread.last_outbound_at).getTime()
}

function threadMatchesFilter(thread, filter, currentStaffId) {
  if (filter === 'all') return true
  if (filter === 'needs_reply') return needsReply(thread)
  if (filter === 'mine') return Boolean(currentStaffId && thread.assigned_staff_id === currentStaffId)
  if (filter === 'human') return thread.mode === 'human' || thread.mode === 'waiting_for_staff'
  return thread.mode === filter
}

function assignmentLabel(thread, currentStaffId) {
  if (!thread.assigned_staff_id) return 'Unassigned'
  if (currentStaffId && thread.assigned_staff_id === currentStaffId) return 'Assigned to me'
  if (thread.profiles?.full_name) return `Assigned to ${thread.profiles.full_name}`
  return 'Assigned to staff'
}

function MessageBubble({ message }) {
  const isGuest = message.sender_type === 'customer'
  const isSystem = message.sender_type === 'system'
  const bg = isSystem ? '#F6EFE4' : isGuest ? '#FFFFFF' : '#E8EFEA'
  const align = isGuest ? 'flex-start' : 'flex-end'

  return (
    <div style={{ display: 'flex', justifyContent: align }}>
      <div style={{
        maxWidth: '76%',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '10px 12px',
        background: bg,
        boxShadow: '0 4px 16px rgba(28,25,23,0.04)',
      }}>
        <div style={{
          font: '700 10px Inter,sans-serif',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: isSystem ? '#C4924A' : isGuest ? '#3B5249' : '#7B4B2A',
          marginBottom: 5,
        }}>
          {message.sender_type} · {message.channel}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', font: '400 13px/1.55 Inter,sans-serif', color: '#1C1917' }}>
          {message.body || 'Attachment / event'}
        </div>
        <div style={{ marginTop: 6, font: '400 10px Inter,sans-serif', color: '#9B9390' }}>
          {new Date(message.created_at).toLocaleString()}
          {message.delivery_status ? ` · ${message.delivery_status}` : ''}
        </div>
      </div>
    </div>
  )
}

export default function ConversationsClient({ initialThreads, activeId, initialMessages, currentStaffId }) {
  const router = useRouter()
  const messagesRef = useRef(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  const activeThread = useMemo(
    () => initialThreads.find(thread => thread.id === activeId) ?? initialThreads[0] ?? null,
    [initialThreads, activeId],
  )

  const attentionCount = useMemo(
    () => initialThreads.filter(needsReply).length,
    [initialThreads],
  )

  const filterCounts = useMemo(() => Object.fromEntries(
    FILTERS.map(item => [
      item.key,
      initialThreads.filter(thread => threadMatchesFilter(thread, item.key, currentStaffId)).length,
    ]),
  ), [currentStaffId, initialThreads])

  const visibleThreads = useMemo(
    () => initialThreads.filter(thread => threadMatchesFilter(thread, filter, currentStaffId)),
    [currentStaffId, filter, initialThreads],
  )

  const refreshInbox = useCallback(() => {
    setLastRefreshedAt(new Date())
    router.refresh()
  }, [router])

  useEffect(() => {
    const node = messagesRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [activeThread?.id, initialMessages.length])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (busy || reply.trim() || document.visibilityState !== 'visible') return
      refreshInbox()
    }, 6000)
    return () => window.clearInterval(interval)
  }, [busy, refreshInbox, reply])

  const selectThread = id => router.push(`/dashboard/conversations?thread=${id}`)

  const setMode = async mode => {
    if (!activeThread) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/conversations/${activeThread.id}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setError(body.error || 'Could not update the conversation.')
    else {
      if (body.notice_status === 'failed') {
        setError('Mode changed, but the WhatsApp notice could not be sent.')
      } else if (body.notice_status === 'twilio_not_configured') {
        setError('Mode changed, but WhatsApp notices are not configured yet.')
      }
      refreshInbox()
    }
    setBusy(false)
  }

  const sendReply = async event => {
    event.preventDefault()
    if (!activeThread || !reply.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/conversations/${activeThread.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setError(body.error || 'Could not send the reply.')
    else {
      setReply('')
      refreshInbox()
    }
    setBusy(false)
  }

  const modeButtonStyle = mode => {
    if (busy) return btnDisabled
    return activeThread?.mode === mode ? btnActiveMode : btnGhost
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
      <section style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ font: '700 12px Inter,sans-serif', color: '#1C1917' }}>Recent threads</span>
                {attentionCount > 0 && <span style={attentionPill}>{attentionCount} need reply</span>}
              </div>
              <div style={{ marginTop: 3, font: '400 11px Inter,sans-serif', color: '#9B9390' }}>
                {initialThreads.length} latest conversations · refreshed {lastRefreshedAt.toLocaleTimeString()}
              </div>
            </div>
            <button onClick={refreshInbox} disabled={busy} style={{ ...btnGhost, padding: '7px 10px', fontSize: 11 }}>Refresh</button>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            {FILTERS.map(item => {
              const active = filter === item.key
              const count = filterCounts[item.key] ?? 0
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  style={active ? filterChipActive : filterChip}
                >
                  {item.label} <span style={active ? filterCountActive : filterCount}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {visibleThreads.map(thread => {
            const active = thread.id === activeThread?.id
            const attention = needsReply(thread)
            return (
              <button
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderBottom: '1px solid var(--color-border)',
                  background: active ? '#F6EFE4' : attention ? '#FFF9EC' : '#fff',
                  padding: 14,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {attention && <span aria-label="Needs reply" title="Guest is waiting for a reply" style={attentionDot} />}
                    <div style={{ font: attention ? '800 13px Inter,sans-serif' : '700 13px Inter,sans-serif', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guestName(thread)}</div>
                  </div>
                  <div style={{ flexShrink: 0, font: attention ? '800 10px Inter,sans-serif' : '500 10px Inter,sans-serif', color: attention ? '#C4924A' : '#9B9390' }}>{timeAgo(thread.last_active_at)}</div>
                </div>
                <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ font: '700 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6663' }}>{thread.channel}</span>
                  {attention && <span style={attentionBadge}>Needs reply</span>}
                  <span style={assignmentBadge(thread, currentStaffId)}>{assignmentLabel(thread, currentStaffId)}</span>
                  <span style={{
                    borderRadius: 999,
                    padding: '3px 8px',
                    background: MODE_COLORS[thread.mode] || '#9B9390',
                    color: '#fff',
                    font: '700 10px Inter,sans-serif',
                  }}>
                    {MODE_LABELS[thread.mode] || thread.mode}
                  </span>
                </div>
              </button>
            )
          })}
          {visibleThreads.length === 0 && (
            <div style={{ padding: 18, font: '400 13px/1.6 Inter,sans-serif', color: '#9B9390' }}>
              No conversations in this view.
            </div>
          )}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, minHeight: 560, overflow: 'hidden' }}>
        {activeThread ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, font: '400 26px Cormorant Garamond,serif', color: '#1C1917' }}>{guestName(activeThread)}</h2>
                <div style={{ marginTop: 4, font: '400 12px Inter,sans-serif', color: '#6B6663' }}>
                  {activeThread.whatsapp_address?.replace(/^whatsapp:/, '') || 'Website chat'}
                  {activeThread.customers?.email ? ` · ${activeThread.customers.email}` : ''}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={assignmentBadge(activeThread, currentStaffId)}>{assignmentLabel(activeThread, currentStaffId)}</span>
                </div>
                {needsReply(activeThread) && (
                  <div style={{ display: 'inline-flex', marginTop: 10, alignItems: 'center', gap: 7, borderRadius: 999, padding: '5px 10px', background: '#FFF3D8', color: '#8A5B13', font: '800 11px Inter,sans-serif' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: '#C4924A' }} />
                    Guest is waiting for a reply
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button disabled={busy} onClick={() => activeThread.mode !== 'human' && setMode('human')} style={modeButtonStyle('human')} aria-pressed={activeThread.mode === 'human'}>Take over</button>
                <button disabled={busy} onClick={() => activeThread.mode !== 'bot' && setMode('bot')} style={modeButtonStyle('bot')} aria-pressed={activeThread.mode === 'bot'}>Return to bot</button>
                <button disabled={busy} onClick={() => activeThread.mode !== 'closed' && setMode('closed')} style={modeButtonStyle('closed')} aria-pressed={activeThread.mode === 'closed'}>Close</button>
              </div>
            </div>

            <div ref={messagesRef} style={{ padding: 16, background: '#FBF8F3', minHeight: 360, maxHeight: '56vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, scrollBehavior: 'smooth' }}>
              {initialMessages.map(message => <MessageBubble key={message.id} message={message} />)}
              {initialMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No messages in this thread yet.</div>
              )}
            </div>

            <form onSubmit={sendReply} style={{ padding: 16, borderTop: '1px solid var(--color-border)' }}>
              {error && <div style={{ marginBottom: 10, color: '#A33', font: '600 12px Inter,sans-serif' }}>{error}</div>}
              <textarea
                value={reply}
                onChange={event => setReply(event.target.value)}
                placeholder={activeThread.whatsapp_address ? 'Reply to the guest on WhatsApp…' : 'This thread has no WhatsApp number yet.'}
                disabled={busy || !activeThread.whatsapp_address || activeThread.mode === 'closed'}
                rows={4}
                style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, font: '400 13px/1.5 Inter,sans-serif', resize: 'vertical' }}
              />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>
                  Sending a staff reply switches the thread to Staff active, so the bot stays quiet.
                </div>
                <button disabled={busy || !reply.trim() || !activeThread.whatsapp_address || activeThread.mode === 'closed'} style={btnPrimary}>
                  Send WhatsApp reply
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ padding: 30, color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Select a conversation to begin.</div>
        )}
      </section>
    </div>
  )
}

const btnPrimary = {
  border: 0,
  borderRadius: 6,
  background: '#3B5249',
  color: '#fff',
  padding: '9px 13px',
  font: '700 12px Inter,sans-serif',
  cursor: 'pointer',
}

const btnActiveMode = {
  ...btnPrimary,
  boxShadow: '0 0 0 3px rgba(59,82,73,0.12)',
}

const attentionPill = {
  borderRadius: 999,
  padding: '3px 8px',
  background: '#FFF3D8',
  color: '#8A5B13',
  font: '800 10px Inter,sans-serif',
}

const attentionDot = {
  width: 9,
  height: 9,
  borderRadius: 999,
  background: '#C4924A',
  boxShadow: '0 0 0 3px rgba(196,146,74,0.16)',
  flexShrink: 0,
}

const attentionBadge = {
  borderRadius: 999,
  padding: '3px 8px',
  background: '#C4924A',
  color: '#fff',
  font: '800 10px Inter,sans-serif',
}

function assignmentBadge(thread, currentStaffId) {
  const mine = currentStaffId && thread.assigned_staff_id === currentStaffId
  const unassigned = !thread.assigned_staff_id
  return {
    borderRadius: 999,
    padding: '3px 8px',
    background: mine ? '#E8EFEA' : unassigned ? '#F4F0EA' : '#EFE7DC',
    color: mine ? '#3B5249' : unassigned ? '#7A716B' : '#7B4B2A',
    font: '800 10px Inter,sans-serif',
  }
}

const filterChip = {
  border: '1px solid var(--color-border)',
  borderRadius: 999,
  background: '#fff',
  color: '#3B5249',
  padding: '6px 10px',
  font: '800 10px Inter,sans-serif',
  cursor: 'pointer',
}

const filterChipActive = {
  ...filterChip,
  borderColor: '#3B5249',
  background: '#3B5249',
  color: '#fff',
}

const filterCount = {
  marginLeft: 4,
  color: '#9B9390',
}

const filterCountActive = {
  marginLeft: 4,
  color: 'rgba(255,255,255,0.72)',
}

const btnGhost = {
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: '#fff',
  color: '#3B5249',
  padding: '9px 13px',
  font: '700 12px Inter,sans-serif',
  cursor: 'pointer',
}

const btnDisabled = {
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: '#EFEAE3',
  color: '#9B9390',
  padding: '9px 13px',
  font: '700 12px Inter,sans-serif',
  cursor: 'not-allowed',
}
