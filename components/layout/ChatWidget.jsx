'use client'

// ============================================================
// TON MAI SPA — ChatWidget
// State-of-the-art chatbot widget with full session persistence
// Same device: automatic (localStorage). Cross-device: phone match.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'

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
  const [guestInfo,   setGuestInfo]   = useState({ name: null, phone: null })
  const [unread,      setUnread]      = useState(0)
  const [toolResults, setToolResults] = useState({}) // {messageIndex: toolResult}

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const abortRef       = useRef(null)

  // ── Initialise session on mount ────────────────────────────
  useEffect(() => {
    if (!chatbotEnabled) return
    initSession()
  }, [chatbotEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setGuestInfo({ name: session.guest_name, phone: session.guest_phone })

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

  // ── Phone number lookup (cross-device) ────────────────────
  // When guest provides their phone number in chat,
  // check if we have a prior session for that number.
  // Runs server-side (admin client) — the browser never queries
  // chat_sessions directly by phone number.
  const checkPhoneMatch = useCallback(async (phone) => {
    const currentSid = localStorage.getItem(STORAGE_KEY)
    try {
      const res = await fetch('/api/chat/phone-lookup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, currentSessionId: currentSid }),
      })
      const data = await res.json()
      if (data.matched) {
        setMessages(data.messages)
        setGuestInfo({ name: data.guestName, phone })
        return true
      }
    } catch {}
    return false
  }, [])

  // ── Send message ───────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text.trim() || isStreaming || !sessionId) return

    // Detect if guest typed a phone number — check for cross-device match
    const phoneMatch = text.match(/(\+?[\d\s\-]{9,15})/)
    if (phoneMatch && !guestInfo.phone) {
      const rawPhone = phoneMatch[1].replace(/[\s\-]/g, '')
      const matched = await checkPhoneMatch(rawPhone)
      if (matched) {
        setInput('')
        return
      }
    }

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
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      })

      if (!res.ok) throw new Error('API error')

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
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText }
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
            content: "I'm having a moment — please try again, or WhatsApp us directly at +66 63 117 5211 🙏",
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
    if (tool === 'create_booking' && result.ok) {
      setToolResults(prev => ({ ...prev, booking: result }))
      if (window.gtag) window.gtag('event', 'booking_complete', { method: 'chatbot' })
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
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
            width: '56px', height: '56px', borderRadius: '9999px',
            background: '#3B5249', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(28,25,23,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms ease-out',
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
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
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
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#FAF6F0' }}>Ton Mai Spa</div>
              <div style={{ fontSize: '10px', color: 'rgba(250,246,240,0.7)', marginTop: '1px' }}>
                {isStreaming ? 'Typing…' : 'Usually replies instantly'}
              </div>
            </div>
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
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 14px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
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
                      {msg.content || (
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

                {/* Booking confirmation card */}
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
                  <button key={i} onClick={() => sendMessage(qr)} style={{
                    background: 'transparent', border: '1px solid #E0D9D0',
                    borderRadius: '9999px', padding: '5px 12px',
                    fontSize: '11px', color: '#3B5249', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontWeight: '500',
                    transition: 'background 150ms',
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
                  placeholder="Ask about treatments, prices, hours…"
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
    return ['Book via WhatsApp', 'Tell me more first']
  }
  return ['Opening hours?', 'Where are you?', 'Book a massage']
}

// ── Sub-components ─────────────────────────────────────────────
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

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '4px', opacity: 0.8,
}
