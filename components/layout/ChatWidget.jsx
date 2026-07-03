'use client'

// ============================================================
// TON MAI SPA — ChatWidget
// Chatbot widget with same-device session persistence.
// Cross-device restoration requires verified identity and is intentionally off.
// ============================================================

import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'tms_chat_id'
const WELCOME_NEW = "Sawasdee kha 🙏 Welcome to Ton Mai Spa. How can I help you today?"
const WELCOME_BACK_TODAY = (name) =>
  `Welcome back${name ? `, ${name}` : ''}! How can I help you?`
const WELCOME_BACK_DAYS = (name, topic) =>
  `Good to see you again${name ? `, ${name}` : ''}! ${topic ? `Last time you were asking about ${topic}. ` : ''}How can I help today?`

export default function ChatWidget({ chatbotEnabled = true }) {
  const [isOpen,      setIsOpen]      = useState(false)
  const [isMinimised, setIsMinimised] = useState(false)
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId,   setSessionId]   = useState(null)
  const [unread,      setUnread]      = useState(0)
  const [toolResults, setToolResults] = useState({}) // {messageIndex: toolResult}
  const [clearStickyBar, setClearStickyBar] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const abortRef       = useRef(null)

  // ── Initialise session on mount ────────────────────────────
  useEffect(() => {
    if (!chatbotEnabled) return
    initSession()
  }, [chatbotEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shift up above the mobile sticky booking bar once it appears ──
  useEffect(() => {
    const update = () => setClearStickyBar(window.scrollY > 300 && window.innerWidth < 860)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // ── Scroll to bottom on new messages ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Focus input when opened ────────────────────────────────
  useEffect(() => {
    if (isOpen && !isMinimised) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimised])

  // ── Reset unread when opened ───────────────────────────────
  useEffect(() => {
    if (isOpen) setUnread(0)
  }, [isOpen])

  const initSession = async () => {
    // Get or create session ID from localStorage
    let sid = localStorage.getItem(STORAGE_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, sid)
    }
    setSessionId(sid)

    // Fetch prior conversation via server route (admin client — no direct table access from browser)
    let session = null
    try {
      const res = await fetch(`/api/chat/session?sessionId=${encodeURIComponent(sid)}`)
      const data = await res.json()
      session = data.session
    } catch {}

    if (session?.messages?.length > 0) {
      // Returning visitor — restore conversation
      setMessages(session.messages)
      if (session.metadata?.booking_draft) {
        const draft = session.metadata.booking_draft
        setToolResults(prev => ({
          ...prev,
          draft: {
            token: draft.token,
            expires_at: draft.expires_at,
            summary: {
              guest_name: draft.guest_name,
              guest_phone: maskPhone(draft.guest_phone),
              treatment: draft.treatment_name,
              date: draft.date,
              time: draft.time_slot,
              duration: draft.duration,
              price: draft.price,
            },
          },
        }))
      }

      // Personalise greeting based on time since last visit
      const lastActive = new Date(session.last_active)
      const hoursSince = (Date.now() - lastActive.getTime()) / 1000 / 3600

      if (hoursSince > 4) {
        // Been away long enough — add a return greeting
        const topic = session.metadata?.interests?.[0] ?? null
        const greeting = {
          role:      'assistant',
          content:   WELCOME_BACK_DAYS(session.guest_name, topic),
          timestamp: new Date().toISOString(),
          isReturn:  true,
        }
        setMessages(prev => [...prev, greeting])
        setUnread(1)
      }
    } else {
      // New visitor
      setMessages([{
        role:      'assistant',
        content:   WELCOME_NEW,
        timestamp: new Date().toISOString(),
      }])
    }
  }

  // ── Send message ───────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text.trim() || isStreaming || !sessionId) return

    const userMsg = {
      role:      'user',
      content:   text,
      timestamp: new Date().toISOString(),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Placeholder for assistant reply
    const assistantPlaceholder = {
      role:      'assistant',
      content:   '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    setMessages(prev => [...prev, assistantPlaceholder])
    const assistantIndex = newMessages.length // index in the array

    let fullText = ''
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body:    JSON.stringify({
          messages: messagesForRequest(newMessages),
          sessionId,
        }),
      })

      if (!res.ok) {
        let errorBody = {}
        try { errorBody = await res.json() } catch {}
        const error = new Error(errorBody.error || 'The chat service is temporarily unavailable.')
        error.userMessage = res.status === 429
          ? `${errorBody.error} You can continue on WhatsApp if your question is urgent.`
          : errorBody.error
        throw error
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const event = JSON.parse(line)

            if (event.type === 'text') {
              fullText += event.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: fullText,
                }
                return updated
              })
            }

            if (event.type === 'tool_result') {
              handleToolResult(event.tool, event.result)
            }

            if (event.type === 'error') {
              fullText = event.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText, isError: true }
                return updated
              })
            }
          } catch {}
        }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: err.userMessage || "I'm having a moment — please try again, or WhatsApp us directly at +66 63 117 5211 🙏",
            isError: true,
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      setMessages(prev => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.isStreaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false }
        }
        return updated
      })
      if (!isOpen) setUnread(prev => prev + 1)
    }
  }

  const handleToolResult = (tool, result) => {
    if (tool === 'capture_booking_intent' && result.ok) {
      if (window.gtag) window.gtag('event', 'enquiry_submit', { method: 'chatbot' })
    }
    if (tool === 'update_guest_info' && result.ok) {
      // Will be reflected on next session load
    }
    if (tool === 'check_availability' && result.ok) {
      setToolResults(prev => ({ ...prev, availability: result }))
    }
    if (tool === 'prepare_booking' && result.ok) {
      setToolResults(prev => ({ ...prev, draft: result, booking: null }))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setIsMinimised(false)
    setUnread(0)
    if (window.gtag) window.gtag('event', 'chat_open')
  }

  const handleClose = () => {
    if (isStreaming) abortRef.current?.abort()
    setIsOpen(false)
  }

  const handleNewConversation = async () => {
    if (!window.confirm('Start a new conversation and permanently delete this chat history?')) return
    if (isStreaming) abortRef.current?.abort()

    try {
      const res = await fetch(`/api/chat/session?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Unable to delete conversation')

      const nextSessionId = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, nextSessionId)
      setSessionId(nextSessionId)
      setMessages([{
        role: 'assistant',
        content: WELCOME_NEW,
        timestamp: new Date().toISOString(),
      }])
      setToolResults({})
      setInput('')
      setUnread(0)
      setIsStreaming(false)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not clear this conversation. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      }])
    }
  }

  if (!chatbotEnabled) return null

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Open chat"
          style={{
            position: 'fixed', bottom: clearStickyBar ? '92px' : '24px', right: '24px', zIndex: 999,
            width: '56px', height: '56px', borderRadius: '9999px',
            background: '#3B5249', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(28,25,23,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms ease-out, bottom 200ms ease-out',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#FAF6F0"/>
          </svg>
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#C4924A', color: '#fff',
              borderRadius: '9999px', minWidth: '20px', height: '20px',
              fontSize: '11px', fontWeight: '700', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
            }}>{unread}</span>
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
          style={{
          position: 'fixed', bottom: clearStickyBar ? '92px' : '24px', right: '24px', zIndex: 999,
          width: 'clamp(320px, 90vw, 390px)',
          height: isMinimised ? 'auto' : 'clamp(480px, 70vh, 600px)',
          background: '#FAF6F0', borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(28,25,23,0.2)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif', overflow: 'hidden',
          border: '1px solid #E0D9D0',
          }}>

          {/* Header */}
          <div style={{
            background: '#3B5249', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '10px',
            flexShrink: 0,
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9999px',
              background: '#FAF6F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '16px' }}>🌳</span>
            </div>
            <div style={{ flex: 1 }}>
              <div id="chat-title" style={{ fontSize: '13px', fontWeight: '600', color: '#FAF6F0' }}>Ton Mai Spa</div>
              <div style={{ fontSize: '10px', color: 'rgba(250,246,240,0.7)', marginTop: '1px' }}>
                {isStreaming ? 'Typing…' : 'Usually replies instantly'}
              </div>
            </div>
            <button
              onClick={handleNewConversation}
              aria-label="Start a new conversation"
              disabled={isStreaming}
              style={{
                ...iconBtnStyle,
                color: '#FAF6F0',
                fontSize: '10px',
                fontFamily: 'Inter, sans-serif',
                opacity: isStreaming ? 0.4 : 0.85,
              }}
            >
              New
            </button>
            <button onClick={() => setIsMinimised(v => !v)} aria-label="Minimise" style={iconBtnStyle}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d={isMinimised ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} stroke="#FAF6F0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onClick={handleClose} aria-label="Close chat" style={iconBtnStyle}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="#FAF6F0" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {!isMinimised && (
            <>
              {/* Messages */}
              <div role="log" aria-live="polite" aria-relevant="additions text" style={{
                flex: 1, overflowY: 'auto', padding: '16px 14px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div role={msg.isError ? 'alert' : undefined} style={{
                      maxWidth: '82%',
                      background: msg.role === 'user' ? '#3B5249' : '#fff',
                      color: msg.role === 'user' ? '#FAF6F0' : '#1C1917',
                      padding: '10px 13px',
                      borderRadius: msg.role === 'user'
                        ? '12px 12px 2px 12px'
                        : '12px 12px 12px 2px',
                      fontSize: '13px', lineHeight: '1.6',
                      boxShadow: '0 1px 3px rgba(28,25,23,0.08)',
                      border: msg.role === 'assistant' ? '1px solid #E0D9D0' : 'none',
                    }}>
                      {msg.content ? <MessageContent content={msg.content} /> : (
                        <span style={{ opacity: 0.5 }}>
                          <TypingDots />
                        </span>
                      )}
                      {msg.isReturn && (
                        <div style={{ fontSize: '10px', color: '#C4924A', marginTop: '4px', fontWeight: '600' }}>
                          ✦ Remembered you
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Booking review and confirmation cards */}
                {toolResults.draft && !toolResults.booking && (
                  <BookingDraftCard
                    draft={toolResults.draft}
                    sessionId={sessionId}
                    onConfirmed={(booking) => {
                      setToolResults(prev => ({ ...prev, draft: null, booking }))
                      if (window.gtag) window.gtag('event', 'booking_complete', { method: 'chatbot' })
                    }}
                  />
                )}
                {toolResults.booking && (
                  <BookingConfirmCard refCode={toolResults.booking.ref_code} />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              <div style={{
                padding: '0 14px 10px',
                display: 'flex', gap: '6px', flexWrap: 'wrap',
              }}>
                {getQuickReplies(messages).map((qr, i) => (
                  <button key={i} onClick={() => sendMessage(qr)} disabled={isStreaming} style={{
                    background: 'transparent', border: '1px solid #E0D9D0',
                    borderRadius: '9999px', padding: '5px 12px',
                    fontSize: '11px', color: '#3B5249', cursor: isStreaming ? 'default' : 'pointer',
                    fontFamily: 'Inter, sans-serif', fontWeight: '500',
                    transition: 'background 150ms', opacity: isStreaming ? 0.55 : 1,
                  }}>
                    {qr}
                  </button>
                ))}
              </div>

              {/* Input area */}
              <div style={{
                padding: '10px 14px 14px',
                borderTop: '1px solid #E0D9D0',
                display: 'flex', gap: '8px', alignItems: 'flex-end',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label="Message Ton Mai Spa"
                  placeholder="Ask about treatments, prices, hours…"
                  maxLength={2000}
                  rows={1}
                  disabled={isStreaming}
                  style={{
                    flex: 1, border: '1px solid #E0D9D0', borderRadius: '8px',
                    padding: '9px 12px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                    resize: 'none', background: '#fff', color: '#1C1917',
                    outline: 'none', lineHeight: '1.5',
                    maxHeight: '100px', overflowY: 'auto',
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send"
                  style={{
                    background: input.trim() && !isStreaming ? '#3B5249' : '#E0D9D0',
                    border: 'none', borderRadius: '8px',
                    width: '38px', height: '38px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
                    transition: 'background 150ms',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h12M8 2l6 6-6 6" stroke="#FAF6F0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Footer */}
              <div style={{
                textAlign: 'center', padding: '6px 14px 10px',
                fontSize: '10px', color: '#B8B5B3',
              }}>
                Powered by Ton Mai Spa · <a href="https://wa.me/66631175211" target="_blank" rel="noopener noreferrer" style={{ color: '#3B5249' }}>WhatsApp us</a>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

// ── Smart quick replies based on conversation state ───────────
function getQuickReplies(messages) {
  if (messages.length <= 1) {
    return ['What treatments do you have?', 'How much is the sauna?', 'How do I book?']
  }
  const lastBot = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''
  if (lastBot.toLowerCase().includes('massage')) {
    return ['Prices?', 'How long?', 'Can I book now?']
  }
  if (lastBot.toLowerCase().includes('book')) {
    return ['Continue booking', 'Tell me more first']
  }
  return ['Opening hours?', 'Where are you?', 'Book a massage']
}

function messagesForRequest(messages) {
  const selected = []
  let characters = 0

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (selected.length >= 24 || characters >= 20000) break
    const message = messages[index]
    if (!message?.content || !['user', 'assistant'].includes(message.role)) continue

    const content = String(message.content).slice(0, 4000)
    if (selected.length > 0 && characters + content.length > 20000) continue
    selected.unshift({ role: message.role, content })
    characters += content.length
  }

  return selected
}

// ── Sub-components ─────────────────────────────────────────────
function MessageContent({ content }) {
  const tokens = String(content).split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g)

  return (
    <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {tokens.map((token, index) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return <strong key={index}>{token.slice(2, -2)}</strong>
        }
        if (/^https?:\/\//.test(token)) {
          return (
            <a key={index} href={token} target="_blank" rel="noopener noreferrer" style={{ color: '#3B5249' }}>
              {token}
            </a>
          )
        }
        return token
      })}
    </span>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: '5px', height: '5px', borderRadius: '50%', background: '#B8B5B3',
          animation: `bounce 1.2s ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0) }
          40% { transform: translateY(-4px) }
        }
      `}</style>
    </span>
  )
}

function BookingConfirmCard({ refCode }) {
  return (
    <div style={{
      background: '#E8EDE9', border: '1px solid #3B5249',
      borderRadius: '8px', padding: '12px 14px',
      fontSize: '12px', color: '#1C1917',
    }}>
      <div style={{ fontWeight: '600', color: '#3B5249', marginBottom: '4px' }}>✓ Booking Request Sent</div>
      <div>Reference: <strong>{refCode}</strong></div>
      <div style={{ marginTop: '4px', color: '#6B6663' }}>The team will confirm via WhatsApp shortly.</div>
    </div>
  )
}

function BookingDraftCard({ draft, sessionId, onConfirmed }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState('')
  const summary = draft.summary ?? {}

  const confirmBooking = async () => {
    if (isConfirming || !sessionId || !draft.token) return
    setIsConfirming(true)
    setError('')

    try {
      const res = await fetch('/api/chat/confirm-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token: draft.token }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        const alternatives = result.nearest_open_times?.length
          ? ` Available times: ${result.nearest_open_times.join(', ')}.`
          : ''
        throw new Error(`${result.error || 'Could not confirm this booking.'}${alternatives}`)
      }
      onConfirmed(result)
    } catch (err) {
      setError(err.message || 'Could not confirm this booking. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #C4924A',
      borderRadius: '8px', padding: '12px 14px',
      fontSize: '12px', color: '#1C1917',
    }}>
      <div style={{ fontWeight: '700', color: '#3B5249', marginBottom: '8px' }}>Review your booking</div>
      <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: '4px 8px' }}>
        <span style={{ color: '#6B6663' }}>Treatment</span><strong>{summary.treatment}</strong>
        <span style={{ color: '#6B6663' }}>Date</span><span>{formatBookingDate(summary.date)}</span>
        <span style={{ color: '#6B6663' }}>Time</span><span>{summary.time}</span>
        <span style={{ color: '#6B6663' }}>Duration</span><span>{summary.duration} minutes</span>
        {summary.price != null && <><span style={{ color: '#6B6663' }}>Price</span><span>{summary.price} THB</span></>}
        <span style={{ color: '#6B6663' }}>Guest</span><span>{summary.guest_name}</span>
        <span style={{ color: '#6B6663' }}>Phone</span><span>{summary.guest_phone}</span>
      </div>
      <div style={{ marginTop: '9px', color: '#6B6663', lineHeight: '1.45' }}>
        Nothing is booked until you press the button below. The spa team will confirm the pending request via WhatsApp.
      </div>
      <button
        type="button"
        onClick={confirmBooking}
        disabled={isConfirming}
        style={{
          width: '100%', marginTop: '10px', padding: '9px 12px',
          border: 'none', borderRadius: '7px', background: isConfirming ? '#9EA9A4' : '#3B5249',
          color: '#fff', fontSize: '12px', fontWeight: '700',
          fontFamily: 'Inter, sans-serif', cursor: isConfirming ? 'wait' : 'pointer',
        }}
      >
        {isConfirming ? 'Confirming…' : 'Confirm booking'}
      </button>
      {error && <div role="alert" style={{ marginTop: '8px', color: '#A33A2B', lineHeight: '1.45' }}>{error}</div>}
    </div>
  )
}

function formatBookingDate(date) {
  if (!date) return ''
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function maskPhone(phone) {
  const clean = String(phone ?? '')
  return clean.length <= 4 ? clean : `${'•'.repeat(Math.min(6, clean.length - 4))}${clean.slice(-4)}`
}

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '4px', opacity: 0.8,
}
