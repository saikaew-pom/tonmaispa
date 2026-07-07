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
  // Carries phone/email forward from the last confirmed booking so a
  // booker preparing a second booking for a companion doesn't have to
  // retype the same contact details — the name field always starts blank.
  const [lastContact, setLastContact] = useState(null) // { countryCode, localPhone, email }

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
      if (session.metadata?.reschedule_draft) {
        setToolResults(prev => ({
          ...prev,
          rescheduleDraft: session.metadata.reschedule_draft,
          draft: null,
          booking: null,
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
            content: err.userMessage || "I'm having a moment — please try again, or WhatsApp us directly at +66 82 286 6058 🙏",
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
      setToolResults(prev => ({ ...prev, draft: result, booking: null, rescheduleDraft: null, reschedule: null }))
    }
    if (tool === 'prepare_reschedule' && result.ok) {
      setToolResults(prev => ({ ...prev, rescheduleDraft: result, reschedule: null, draft: null, booking: null }))
    }
    if (tool === 'start_booking_lookup' && result.ok) {
      setToolResults(prev => ({ ...prev, bookingLookup: result, draft: null, booking: null, rescheduleDraft: null, reschedule: null }))
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
                {toolResults.bookingLookup && (
                  <BookingLookupCard
                    sessionId={sessionId}
                    initialResult={toolResults.bookingLookup}
                    onSelectBooking={booking => {
                      setToolResults(prev => ({ ...prev, bookingLookup: null }))
                      sendMessage(`I want to reschedule booking ${booking.ref_code}.`)
                    }}
                  />
                )}
                {toolResults.draft && !toolResults.booking && (
                  <BookingDraftCard
                    draft={toolResults.draft}
                    sessionId={sessionId}
                    lastContact={lastContact}
                    onConfirmed={(booking, contact) => {
                      setToolResults(prev => ({ ...prev, draft: null, booking }))
                      setLastContact(contact)
                      if (window.gtag) window.gtag('event', 'booking_complete', { method: 'chatbot' })
                    }}
                  />
                )}
                {toolResults.booking && (
                  <BookingConfirmCard
                    refCode={toolResults.booking.ref_code}
                    whatsapp={toolResults.booking.whatsapp}
                    bookingId={toolResults.booking.booking_id}
                    sessionId={sessionId}
                    disabled={isStreaming}
                    onChangeDate={refCode => sendMessage(`I want to change the date of my booking ${refCode}.`)}
                    onBookAnother={() => sendMessage('I would like to book another treatment.')}
                  />
                )}
                {toolResults.rescheduleDraft && !toolResults.reschedule && (
                  <RescheduleDraftCard
                    draft={toolResults.rescheduleDraft}
                    sessionId={sessionId}
                    onConfirmed={reschedule => {
                      setToolResults(prev => ({ ...prev, rescheduleDraft: null, reschedule, draft: null, booking: null }))
                    }}
                  />
                )}
                {toolResults.reschedule && (
                  <RescheduleConfirmCard result={toolResults.reschedule} />
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
                Powered by Ton Mai Spa · <a href="https://wa.me/66822866058" target="_blank" rel="noopener noreferrer" style={{ color: '#3B5249' }}>WhatsApp us</a>
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

const RECEPTIONIST_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66822866058'

// Curated, not exhaustive — covers Thailand (default) plus the countries
// guests most commonly book from. A guest whose country isn't listed can
// still pick "Other" and type their own code.
const COUNTRY_CODES = [
  { code: '+66', label: 'Thailand (+66)' },
  { code: '+1',  label: 'US / Canada (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+7',  label: 'Russia (+7)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: 'other', label: 'Other country code…' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function BookingLookupCard({ sessionId, initialResult, onSelectBooking }) {
  const [step, setStep] = useState(initialResult?.already_verified ? 'bookings' : 'details')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [bookings, setBookings] = useState(initialResult?.bookings ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Per-booking cancel flow: which booking shows the are-you-sure step, which
  // is mid-request, and which have completed (kept in the list as receipts).
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [cancelledIds, setCancelledIds] = useState({})

  const cancelBooking = async (booking) => {
    setCancellingId(booking.booking_id)
    setError('')
    try {
      const res = await fetch('/api/chat/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, booking_id: booking.booking_id }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not cancel this booking.')
      setCancelledIds(prev => ({ ...prev, [booking.booking_id]: result }))
      setConfirmCancelId(null)
    } catch (err) {
      setError(err.message || 'Could not cancel this booking.')
    } finally {
      setCancellingId(null)
    }
  }

  const requestCode = async () => {
    if (!sessionId || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/chat/phone-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', sessionId, phone, email }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not send a verification code.')
      setNotice(result.message)
      setStep('code')
    } catch (err) {
      setError(err.message || 'Could not send a verification code.')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    if (!sessionId || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/chat/phone-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', sessionId, code }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not verify this code.')
      setBookings(result.bookings ?? [])
      setStep('bookings')
    } catch (err) {
      setError(err.message || 'Could not verify this code.')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 9px', border: '1px solid #D6D0C8',
    borderRadius: '6px', font: '400 12px Inter,sans-serif', color: '#1C1917', background: '#fff',
  }
  const buttonStyle = {
    width: '100%', marginTop: '9px', padding: '9px 12px', border: 'none', borderRadius: '7px',
    background: busy ? '#C8C3BC' : '#3B5249', color: '#fff', font: '700 12px Inter,sans-serif',
    cursor: busy ? 'wait' : 'pointer',
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #C4924A', borderRadius: '8px', padding: '12px 14px', fontSize: '12px' }}>
      <div style={{ fontWeight: '700', color: '#3B5249', marginBottom: '5px' }}>Find my booking securely</div>
      {step === 'details' && (
        <>
          <div style={{ color: '#6B6663', lineHeight: 1.45, marginBottom: 9 }}>
            Enter the phone number and email used for the booking. We’ll email a one-time code before showing any details.
          </div>
          <input aria-label="Booking phone number" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+66…" style={inputStyle} />
          <input aria-label="Booking email address" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" style={{ ...inputStyle, marginTop: 7 }} />
          <button type="button" disabled={busy || !phone.trim() || !EMAIL_RE.test(email.trim())} onClick={requestCode} style={{ ...buttonStyle, opacity: !phone.trim() || !EMAIL_RE.test(email.trim()) ? 0.55 : 1 }}>
            {busy ? 'Sending…' : 'Email my verification code'}
          </button>
        </>
      )}
      {step === 'code' && (
        <>
          <div style={{ color: '#6B6663', lineHeight: 1.45, marginBottom: 9 }}>{notice}</div>
          <input aria-label="Six-digit verification code" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" style={{ ...inputStyle, textAlign: 'center', letterSpacing: 5, fontWeight: 700 }} />
          <button type="button" disabled={busy || code.length !== 6} onClick={verifyCode} style={{ ...buttonStyle, opacity: code.length !== 6 ? 0.55 : 1 }}>
            {busy ? 'Verifying…' : 'Verify and show bookings'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setStep('details'); setCode(''); setError('') }} style={{ ...buttonStyle, background: 'transparent', color: '#3B5249', border: '1px solid #D6D0C8' }}>
            Use different details
          </button>
        </>
      )}
      {step === 'bookings' && (
        <>
          <div style={{ color: '#3B5249', fontWeight: 700, marginBottom: 8 }}>✓ Identity verified</div>
          {!bookings.length && <div style={{ color: '#6B6663' }}>There are no pending or confirmed bookings on this profile.</div>}
          <div style={{ display: 'grid', gap: 7 }}>
            {bookings.map(booking => {
              const cancelled = cancelledIds[booking.booking_id]
              if (cancelled) {
                return (
                  <div key={booking.booking_id} style={{ border: '1px solid #DCC1BA', background: '#FBF3EC', borderRadius: 7, padding: 9 }}>
                    <div style={{ fontWeight: 700, color: '#8A5A14' }}>{booking.ref_code} · cancelled</div>
                    <div style={{ color: '#6B6663', marginTop: 3 }}>
                      {booking.treatment} on {formatBookingDate(booking.date)} at {booking.time} is cancelled.
                      {cancelled.email_sent ? ' A confirmation email is on its way.' : ''}
                    </div>
                  </div>
                )
              }
              return (
                <div key={booking.booking_id} style={{ border: '1px solid #E0D9D0', borderRadius: 7, padding: 9 }}>
                  <div style={{ fontWeight: 700 }}>{booking.ref_code} · {booking.treatment}</div>
                  <div style={{ color: '#6B6663', marginTop: 3 }}>{formatBookingDate(booking.date)} at {booking.time} · {booking.duration} min · {booking.status}</div>
                  {booking.price != null && <div style={{ color: '#6B6663', marginTop: 2 }}>{booking.price} THB</div>}
                  {confirmCancelId === booking.booking_id ? (
                    <>
                      <div style={{ color: '#A33A2B', fontWeight: 700, marginTop: 7 }}>Cancel {booking.ref_code} — are you sure?</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" disabled={cancellingId === booking.booking_id} onClick={() => cancelBooking(booking)}
                          style={{ ...buttonStyle, marginTop: 7, background: '#A33A2B' }}>
                          {cancellingId === booking.booking_id ? 'Cancelling…' : 'Yes, cancel it'}
                        </button>
                        <button type="button" disabled={cancellingId === booking.booking_id} onClick={() => setConfirmCancelId(null)}
                          style={{ ...buttonStyle, marginTop: 7, background: 'transparent', color: '#3B5249', border: '1px solid #D6D0C8' }}>
                          Keep it
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => onSelectBooking(booking)} style={{ ...buttonStyle, marginTop: 7 }}>Change this booking</button>
                      <button type="button" onClick={() => setConfirmCancelId(booking.booking_id)}
                        style={{ ...buttonStyle, marginTop: 7, background: 'transparent', color: '#A33A2B', border: '1px solid #DCC1BA' }}>
                        Cancel booking
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {error && <div role="alert" style={{ marginTop: 8, color: '#A33A2B', lineHeight: 1.45 }}>{error}</div>}
    </div>
  )
}

function RescheduleDraftCard({ draft, sessionId, onConfirmed }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState('')

  const confirmReschedule = async () => {
    if (!sessionId || !draft.token || isConfirming) return
    setIsConfirming(true)
    setError('')
    try {
      const res = await fetch('/api/chat/confirm-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token: draft.token }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not reschedule this booking.')
      onConfirmed(result)
    } catch (err) {
      setError(err.message || 'Could not reschedule this booking. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #C4924A', borderRadius: '8px',
      padding: '12px 14px', fontSize: '12px', color: '#1C1917',
    }}>
      <div style={{ fontWeight: '700', color: '#3B5249', marginBottom: '4px' }}>Review your booking change</div>
      <div style={{ color: '#6B6663', marginBottom: '10px' }}>
        Reference <strong>{draft.ref_code}</strong> · {draft.treatment_name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: '5px 8px' }}>
        <span style={{ color: '#6B6663' }}>Current</span>
        <span style={{ textDecoration: 'line-through', color: '#9B9390' }}>
          {formatBookingDate(draft.old_date)} at {draft.old_time_slot}
        </span>
        <span style={{ color: '#6B6663' }}>New</span>
        <strong>{formatBookingDate(draft.new_date)} at {draft.new_time_slot}</strong>
        <span style={{ color: '#6B6663' }}>Duration</span><span>{draft.duration} minutes</span>
        {draft.price != null && <><span style={{ color: '#6B6663' }}>Rate</span><span>{draft.price} THB</span></>}
      </div>
      <div style={{ marginTop: '9px', color: '#6B6663', lineHeight: '1.45' }}>
        This updates the existing booking—no second booking will be created. The same reference stays pending until the spa team confirms the new time.
      </div>
      <button
        type="button"
        onClick={confirmReschedule}
        disabled={isConfirming}
        style={{
          width: '100%', marginTop: '10px', padding: '9px 12px', border: 'none', borderRadius: '7px',
          background: isConfirming ? '#C8C3BC' : '#3B5249', color: '#fff', fontSize: '12px',
          fontWeight: '700', fontFamily: 'Inter, sans-serif', cursor: isConfirming ? 'wait' : 'pointer',
        }}
      >
        {isConfirming ? 'Updating…' : 'Confirm reschedule request'}
      </button>
      {error && <div role="alert" style={{ marginTop: '8px', color: '#A33A2B', lineHeight: '1.45' }}>{error}</div>}
    </div>
  )
}

function RescheduleConfirmCard({ result }) {
  return (
    <div style={{
      background: '#E8EDE9', border: '1px solid #3B5249', borderRadius: '8px',
      padding: '12px 14px', fontSize: '12px', color: '#1C1917',
    }}>
      <div style={{ fontWeight: '600', color: '#3B5249', marginBottom: '4px' }}>✓ Reschedule request sent</div>
      <div>Reference: <strong>{result.ref_code}</strong></div>
      <div style={{ marginTop: '4px' }}>{formatBookingDate(result.date)} at {result.time}</div>
      <div style={{ marginTop: '6px', color: '#6B6663', lineHeight: '1.45' }}>
        Your original booking was updated, not duplicated. The spa team will confirm the new time.
      </div>
      <div style={{ marginTop: '5px', color: result.email_sent ? '#3B5249' : '#A33A2B', lineHeight: '1.45' }}>
        {result.email_sent ? 'A confirmation email has been sent.' : 'The booking is saved, but the email could not be sent. The spa team can still see your request.'}
      </div>
    </div>
  )
}

function BookingConfirmCard({ refCode, whatsapp, bookingId, sessionId, onChangeDate, onBookAnother, disabled }) {
  const phone = whatsapp || RECEPTIONIST_PHONE
  // cancelState: null → 'confirm' (are you sure?) → 'busy' → 'done' | error
  const [cancelState, setCancelState] = useState(null)
  const [cancelResult, setCancelResult] = useState(null)
  const [cancelError, setCancelError] = useState('')

  const doCancel = async () => {
    setCancelState('busy')
    setCancelError('')
    try {
      const res = await fetch('/api/chat/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, booking_id: bookingId || undefined, booking_ref: bookingId ? undefined : refCode }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not cancel this booking.')
      setCancelResult(result)
      setCancelState('done')
    } catch (err) {
      setCancelError(err.message || 'Could not cancel this booking.')
      setCancelState(null)
    }
  }

  const actionBtn = (primary) => ({
    flex: 1, minWidth: 0, padding: '8px 6px', borderRadius: '7px',
    border: primary ? 'none' : '1px solid #D6D0C8',
    background: primary ? '#3B5249' : '#fff',
    color: primary ? '#fff' : '#3B5249',
    font: '700 11px Inter,sans-serif', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  })

  if (cancelState === 'done') {
    return (
      <div style={{ background: '#FBF3EC', border: '1px solid #C4924A', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#1C1917' }}>
        <div style={{ fontWeight: '600', color: '#8A5A14', marginBottom: '4px' }}>Booking {cancelResult.ref_code} cancelled</div>
        <div style={{ color: '#6B6663', lineHeight: '1.45' }}>
          {cancelResult.treatment} on {formatBookingDate(cancelResult.date)} at {cancelResult.time} is cancelled.
          {cancelResult.email_sent ? ' A confirmation email is on its way.' : ''} We hope to welcome you another time 🌿
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#E8EDE9', border: '1px solid #3B5249',
      borderRadius: '8px', padding: '12px 14px',
      fontSize: '12px', color: '#1C1917',
    }}>
      <div style={{ fontWeight: '600', color: '#3B5249', marginBottom: '4px' }}>✓ Booking Request Sent</div>
      <div>Reference: <strong>{refCode}</strong></div>
      <div style={{ marginTop: '4px', color: '#6B6663', lineHeight: '1.45' }}>
        This is <strong>pending confirmation</strong> — our team will contact you shortly, or you can wait for the confirmation email.
      </div>
      <div style={{ marginTop: '6px', color: '#6B6663', lineHeight: '1.45' }}>
        Want to speak with us right away? Call or WhatsApp <strong>+{phone}</strong>.
      </div>

      {cancelState !== 'confirm' ? (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button type="button" disabled={disabled} onClick={() => onChangeDate(refCode)} style={actionBtn(true)}>Change date</button>
          <button type="button" disabled={disabled} onClick={() => setCancelState('confirm')} style={{ ...actionBtn(false), color: '#A33A2B', borderColor: '#DCC1BA' }}>Cancel booking</button>
          <button type="button" disabled={disabled} onClick={onBookAnother} style={actionBtn(false)}>Book another</button>
        </div>
      ) : (
        <div style={{ marginTop: '10px' }}>
          <div style={{ color: '#A33A2B', fontWeight: 600, marginBottom: 6 }}>Cancel booking {refCode} — are you sure?</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" disabled={cancelState === 'busy'} onClick={doCancel}
              style={{ ...actionBtn(true), background: '#A33A2B' }}>
              {cancelState === 'busy' ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button type="button" disabled={cancelState === 'busy'} onClick={() => setCancelState(null)} style={actionBtn(false)}>Keep booking</button>
          </div>
        </div>
      )}
      {cancelError && <div role="alert" style={{ marginTop: 7, color: '#A33A2B', lineHeight: 1.45 }}>{cancelError}</div>}
    </div>
  )
}

function BookingDraftCard({ draft, sessionId, lastContact, onConfirmed }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState('')
  const [guestName, setGuestName] = useState('') // always starts blank — a companion's booking needs their own name
  const [countryCode, setCountryCode] = useState(lastContact?.countryCode ?? '+66')
  const [customCode, setCustomCode] = useState('')
  const [localPhone, setLocalPhone] = useState(lastContact?.localPhone ?? '')
  const [email, setEmail] = useState(lastContact?.email ?? '')
  const summary = draft.summary ?? {}

  const resolvedCode = countryCode === 'other' ? customCode.trim() : countryCode
  const digitsOnly = localPhone.replace(/\D/g, '')
  const codeValid = /^\+[1-9]\d{0,3}$/.test(resolvedCode)
  const nameValid = guestName.trim().length >= 2
  const phoneValid = codeValid && digitsOnly.length >= 6 && digitsOnly.length <= 12
  const emailValid = EMAIL_RE.test(email.trim())
  const canConfirm = nameValid && phoneValid && emailValid && !isConfirming

  const confirmBooking = async () => {
    if (!canConfirm || !sessionId || !draft.token) return
    setIsConfirming(true)
    setError('')

    try {
      const res = await fetch('/api/chat/confirm-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          token: draft.token,
          guest_name: guestName.trim(),
          guest_phone: `${resolvedCode}${digitsOnly}`,
          guest_email: email.trim(),
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        const alternatives = result.nearest_open_times?.length
          ? ` Available times: ${result.nearest_open_times.join(', ')}.`
          : ''
        throw new Error(`${result.error || 'Could not confirm this booking.'}${alternatives}`)
      }
      onConfirmed(result, { countryCode, localPhone, email })
    } catch (err) {
      setError(err.message || 'Could not confirm this booking. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  const fieldSt = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '1px solid #D6D0C8', borderRadius: '5px', font: '400 12px Inter,sans-serif', color: '#1C1917' }
  const labelSt = { display: 'block', fontSize: '10px', fontWeight: '600', color: '#6B6663', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }

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
      </div>

      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F0ECE6' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1C1917', marginBottom: '8px' }}>
          Who is this booking for?
        </div>
        <label style={labelSt}>Guest name</label>
        <input
          type="text" placeholder="Full name" value={guestName}
          onChange={e => setGuestName(e.target.value)}
          style={fieldSt}
        />

        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1C1917', margin: '10px 0 8px' }}>
          Contact details
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelSt}>Country code</label>
            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={fieldSt}>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            {countryCode === 'other' && (
              <input
                type="text" placeholder="+xx" value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                style={{ ...fieldSt, marginTop: '6px' }}
              />
            )}
          </div>
          <div>
            <label style={labelSt}>Phone number</label>
            <input
              type="tel" placeholder="8x xxx xxxx" value={localPhone}
              onChange={e => setLocalPhone(e.target.value)}
              style={fieldSt}
            />
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <label style={labelSt}>Email</label>
          <input
            type="email" placeholder="you@example.com" value={email}
            onChange={e => setEmail(e.target.value)}
            style={fieldSt}
          />
        </div>
        {lastContact && (
          <div style={{ marginTop: '6px', fontSize: '10px', color: '#9B9390' }}>
            Phone/email carried over from your last booking — change them if this is for someone else.
          </div>
        )}
      </div>

      <div style={{ marginTop: '9px', color: '#6B6663', lineHeight: '1.45' }}>
        Nothing is booked until you press the button below. Your request will be pending until the spa team confirms it.
      </div>
      <button
        type="button"
        onClick={confirmBooking}
        disabled={!canConfirm}
        style={{
          width: '100%', marginTop: '10px', padding: '9px 12px',
          border: 'none', borderRadius: '7px', background: !canConfirm ? '#C8C3BC' : '#3B5249',
          color: '#fff', fontSize: '12px', fontWeight: '700',
          fontFamily: 'Inter, sans-serif', cursor: !canConfirm ? (isConfirming ? 'wait' : 'not-allowed') : 'pointer',
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
