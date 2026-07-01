'use client'
import { useState, useEffect, useRef } from 'react'

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const labelSt = { display: 'block', font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B6663', marginBottom: 6 }
const inputSt = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #D6D0C8', borderRadius: 2, font: '400 14px Inter,sans-serif', color: '#1C1917', background: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif' }

export default function SimpleEnquiryForm() {
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [message, setMessage] = useState('')
  const [token, setToken]     = useState('')
  const [status, setStatus]   = useState('idle') // idle | loading | success | error
  const [errMsg, setErrMsg]   = useState('')
  const containerRef = useRef(null)
  const widgetId     = useRef(null)
  const cbRef        = useRef(null)
  cbRef.current = setToken

  useEffect(() => {
    if (!SITEKEY) return
    const render = () => {
      if (window.turnstile && containerRef.current && widgetId.current == null) {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITEKEY,
          callback:          (t) => cbRef.current(t),
          'expired-callback': () => cbRef.current(''),
        })
      }
    }
    if (window.turnstile) { render() }
    else {
      const s = document.createElement('script')
      s.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
    return () => {
      if (widgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch (_) {}
        widgetId.current = null
      }
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrMsg('')
    try {
      const res  = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone, message, turnstileToken: token || 'dev-bypass' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong')
      setStatus('success')
      if (window.gtag) window.gtag('event', 'enquiry_submit', { method: 'simple_form' })
    } catch (err) {
      setStatus('error')
      setErrMsg(err.message)
      if (widgetId.current != null && window.turnstile) window.turnstile.reset(widgetId.current)
      setToken('')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '28px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#3B5249', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style={{ font: '400 24px Cormorant Garamond,serif', color: '#1C1917', margin: '14px 0 0' }}>Enquiry received</h3>
        <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663', marginTop: 8, maxWidth: '30ch', marginLeft: 'auto', marginRight: 'auto' }}>
          We will reply on WhatsApp within minutes. Open 09:00–23:00 every day.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="enq-name" style={labelSt}>Your name</label>
        <input id="enq-name" type="text" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah" style={inputSt} />
      </div>
      <div>
        <label htmlFor="enq-phone" style={labelSt}>WhatsApp number</label>
        <input id="enq-phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+66 63 117 5211" style={inputSt} />
      </div>
      <div>
        <label htmlFor="enq-msg" style={labelSt}>Preferred date &amp; service</label>
        <textarea id="enq-msg" required value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="e.g. Thai massage 90 min, 3 people, Saturday 20 July afternoon" style={{ ...inputSt, resize: 'vertical', minHeight: 80 }} />
      </div>

      {SITEKEY && <div ref={containerRef} />}

      {errMsg && (
        <p role="alert" style={{ font: '400 13px Inter,sans-serif', color: '#C0392B', margin: 0 }}>{errMsg}</p>
      )}

      <button type="submit" disabled={status === 'loading'} style={{ background: '#3B5249', color: '#fff', padding: '15px 24px', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', border: 'none', cursor: status === 'loading' ? 'wait' : 'pointer', opacity: status === 'loading' ? 0.7 : 1, width: '100%' }}>
        {status === 'loading' ? 'Sending…' : 'Send Enquiry'}
      </button>
    </form>
  )
}
