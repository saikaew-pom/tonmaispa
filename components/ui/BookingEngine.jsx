'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS    = ['M','T','W','T','F','S','S']

// ── Turnstile widget ──────────────────────────────────────────────────────────
function TurnstileWidget({ onToken }) {
  const containerRef = useRef(null)
  const widgetId     = useRef(null)
  const cbRef        = useRef(onToken)
  cbRef.current      = onToken

  useEffect(() => {
    if (!SITEKEY) return
    const render = () => {
      if (window.turnstile && containerRef.current && widgetId.current == null) {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey:            SITEKEY,
          callback:           (t) => cbRef.current(t),
          'expired-callback': () => cbRef.current(''),
        })
      }
    }
    if (window.turnstile) { render() }
    else {
      const s = document.createElement('script')
      s.src    = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async  = true
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

  if (!SITEKEY) return null
  return <div ref={containerRef} style={{ marginTop: 4 }} />
}

// ── Mini calendar ─────────────────────────────────────────────────────────────
function Calendar({ year, month, selected, onSelect }) {
  const today   = new Date(); today.setHours(0,0,0,0)
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 90)

  const firstDay = new Date(year, month, 1)
  const startDay = new Date(firstDay)
  const dow0     = firstDay.getDay()
  startDay.setDate(firstDay.getDate() - (dow0 === 0 ? 6 : dow0 - 1))

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDay); d.setDate(startDay.getDate() + i); return d
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', font: '600 10px Inter,sans-serif', letterSpacing: 1, color: '#9B9390', padding: '6px 0' }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          const inMonth  = d.getMonth() === month
          const isPast   = d < today
          const isFuture = d > maxDate
          const dateStr  = d.toISOString().split('T')[0]
          const isSel    = dateStr === selected
          const disabled = isPast || isFuture || !inMonth

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(dateStr)}
              style={{
                padding: '7px 2px', borderRadius: 4, border: 'none',
                font: '400 13px Inter,sans-serif',
                background: isSel ? '#3B5249' : 'transparent',
                color:      isSel ? '#fff' : disabled ? (inMonth ? '#C8C3BC' : 'transparent') : '#1C1917',
                cursor:     disabled ? 'default' : 'pointer',
                transition: 'background 150ms',
              }}
            >
              {inMonth ? d.getDate() : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const inputSt = { width: '100%', boxSizing: 'border-box', padding: '11px 14px', border: '1px solid #D6D0C8', borderRadius: 2, font: '400 14px Inter,sans-serif', color: '#1C1917', background: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif' }
const labelSt = { display: 'block', font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B6663', marginBottom: 6 }
const stepBtnSt = (active) => ({ background: active ? '#3B5249' : '#FAF6F0', color: active ? '#fff' : '#1C1917', border: '1px solid #D6D0C8', padding: '12px 20px', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer' })

// ── Main component ────────────────────────────────────────────────────────────
export default function BookingEngine() {
  const supabase = createClientComponentClient()

  const [step, setStep]               = useState(1)
  const [treatments, setTreatments]   = useState([])
  const [loadingTx, setLoadingTx]     = useState(true)

  // Step 1: treatment + duration
  const [treatment, setTreatment]     = useState(null)
  const [duration, setDuration]       = useState(null)

  // Step 2: date + time
  const [calYear, setCalYear]         = useState(new Date().getFullYear())
  const [calMonth, setCalMonth]       = useState(new Date().getMonth())
  const [selDate, setSelDate]         = useState('')
  const [slots, setSlots]             = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selSlot, setSelSlot]         = useState('')

  // Step 3: guest details
  const [guestName, setGuestName]     = useState('')
  const [guestPhone, setGuestPhone]   = useState('')
  const [guestEmail, setGuestEmail]   = useState('')
  const [notes, setNotes]             = useState('')
  const [token, setToken]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [errMsg, setErrMsg]           = useState('')

  // Step 4: confirmation
  const [refCode, setRefCode]         = useState('')

  // Fetch treatments on mount
  useEffect(() => {
    supabase.from('spa_treatments')
      .select('id, name, category, description, duration_options, prices, badge')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { setTreatments(data ?? []); setLoadingTx(false) })
  }, [supabase])

  // Fetch slots when date changes
  const fetchSlots = useCallback(async (date) => {
    if (!treatment || !duration) return
    setSlotsLoading(true)
    setSelSlot('')
    try {
      const res  = await fetch(`/api/bookings/availability?date=${date}&treatment_id=${treatment.id}&duration=${duration}`)
      const json = await res.json()
      setSlots(json.slots ?? [])
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [treatment, duration])

  const handleDateSelect = async (date) => {
    setSelDate(date)
    await fetchSlots(date)
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrMsg('')
    try {
      const res  = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          guest_name:     guestName,
          guest_phone:    guestPhone,
          guest_email:    guestEmail,
          treatment_id:   treatment.id,
          date:           selDate,
          time_slot:      selSlot,
          duration,
          notes,
          turnstileToken: token || 'dev-bypass',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong')
      setRefCode(json.refCode)
      setStep(4)
      if (window.gtag) window.gtag('event', 'booking_complete', { treatment: treatment.name, duration, value: treatment.prices?.[String(duration)] ?? 0 })
    } catch (err) {
      setErrMsg(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${parseInt(day, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
  }

  // ── Step indicators ────────────────────────────────────────────────────────
  const StepBar = () => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {['Treatment','Date & Time','Your Details'].map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, cursor: done ? 'pointer' : 'default' }}
            onClick={() => done && setStep(n)}>
            <div style={{ height: 3, borderRadius: 2, background: done || active ? '#3B5249' : '#E5E0D8', transition: 'background 300ms' }} />
            <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: done || active ? '#3B5249' : '#C8C3BC' }}>{label}</div>
          </div>
        )
      })}
    </div>
  )

  // ── Step 1: Select treatment ───────────────────────────────────────────────
  if (step === 1) return (
    <div>
      <StepBar />
      <h3 style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 20px' }}>Choose a treatment</h3>
      {loadingTx ? (
        <p style={{ font: '400 14px Inter,sans-serif', color: '#9B9390' }}>Loading treatments…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {treatments.map(t => {
            const sel = treatment?.id === t.id
            return (
              <div key={t.id}
                onClick={() => { setTreatment(t); setDuration(t.duration_options?.[0] ?? 60) }}
                style={{ padding: '16px 18px', border: `1.5px solid ${sel ? '#3B5249' : '#E5E0D8'}`, borderRadius: 4, cursor: 'pointer', background: sel ? '#F0F4F2' : '#fff', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#3B5249' }}>{t.category}</div>
                    <div style={{ font: '400 18px Cormorant Garamond,serif', color: '#1C1917', marginTop: 2 }}>{t.name}</div>
                  </div>
                  {t.badge && <span style={{ background: '#C4924A', color: '#fff', padding: '3px 10px', borderRadius: 999, font: '600 9px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.badge}</span>}
                </div>
                {t.description && <p style={{ font: '400 13px/1.5 Inter,sans-serif', color: '#6B6663', margin: '8px 0 0' }}>{t.description}</p>}
                {sel && t.duration_options && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {t.duration_options.map(dur => (
                      <button key={dur} type="button" onClick={e => { e.stopPropagation(); setDuration(dur) }}
                        style={{ padding: '7px 14px', borderRadius: 2, border: `1.5px solid ${duration === dur ? '#3B5249' : '#D6D0C8'}`, background: duration === dur ? '#3B5249' : '#fff', color: duration === dur ? '#fff' : '#1C1917', font: `600 11px Inter,sans-serif`, cursor: 'pointer' }}>
                        {dur} min {t.prices?.[String(dur)] ? `· ฿${t.prices[String(dur)]}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" disabled={!treatment} onClick={() => setStep(2)} style={{ ...stepBtnSt(true), opacity: treatment ? 1 : 0.4 }}>
          Next: Pick a Date →
        </button>
      </div>
    </div>
  )

  // ── Step 2: Date + time ────────────────────────────────────────────────────
  if (step === 2) return (
    <div>
      <StepBar />
      <h3 style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 4px' }}>
        {treatment?.name} · {duration} min
      </h3>
      <p style={{ font: '400 14px Inter,sans-serif', color: '#9B9390', margin: '0 0 20px' }}>Select a date and time</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
        {/* Calendar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', font: '400 18px Inter,sans-serif', color: '#3B5249', padding: '4px 8px' }}>‹</button>
            <div style={{ font: '600 13px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#1C1917' }}>{MONTHS[calMonth]} {calYear}</div>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', font: '400 18px Inter,sans-serif', color: '#3B5249', padding: '4px 8px' }}>›</button>
          </div>
          <Calendar year={calYear} month={calMonth} selected={selDate} onSelect={handleDateSelect} />
        </div>

        {/* Time slots */}
        <div>
          {!selDate ? (
            <p style={{ font: '400 14px Inter,sans-serif', color: '#9B9390', marginTop: 8 }}>← Pick a date to see available times</p>
          ) : slotsLoading ? (
            <p style={{ font: '400 14px Inter,sans-serif', color: '#9B9390' }}>Loading times…</p>
          ) : !slots.length ? (
            <p style={{ font: '400 14px Inter,sans-serif', color: '#9B9390' }}>No available times on {formatDate(selDate)}. Try another date.</p>
          ) : (
            <>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B6663', marginBottom: 10 }}>
                {formatDate(selDate)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {slots.map(s => {
                  const isSel = selSlot === s.time
                  return (
                    <button key={s.time} type="button" disabled={!s.available}
                      onClick={() => setSelSlot(s.time)}
                      style={{ padding: '10px 6px', borderRadius: 2, border: `1.5px solid ${isSel ? '#3B5249' : s.available ? '#D6D0C8' : '#EEDFD0'}`, background: isSel ? '#3B5249' : s.available ? '#fff' : '#FAFAFA', color: isSel ? '#fff' : s.available ? '#1C1917' : '#C8C3BC', font: '400 13px Inter,sans-serif', cursor: s.available ? 'pointer' : 'default', transition: 'all 150ms', textAlign: 'center' }}>
                      {s.time}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between' }}>
        <button type="button" onClick={() => setStep(1)} style={stepBtnSt(false)}>← Back</button>
        <button type="button" disabled={!selSlot} onClick={() => setStep(3)} style={{ ...stepBtnSt(true), opacity: selSlot ? 1 : 0.4 }}>
          Next: Your Details →
        </button>
      </div>
    </div>
  )

  // ── Step 3: Guest details ──────────────────────────────────────────────────
  if (step === 3) return (
    <form onSubmit={handleSubmit} noValidate>
      <StepBar />
      <h3 style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 6px' }}>Your details</h3>
      <div style={{ font: '400 13px Inter,sans-serif', color: '#9B9390', marginBottom: 20 }}>
        {treatment?.name} · {duration} min · {formatDate(selDate)} at {selSlot}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="bk-name" style={labelSt}>Full name</label>
          <input id="bk-name" type="text" required minLength={2} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Sarah Johnson" style={inputSt} />
        </div>
        <div>
          <label htmlFor="bk-phone" style={labelSt}>WhatsApp / mobile</label>
          <input id="bk-phone" type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+66 63 117 5211" style={inputSt} />
        </div>
        <div>
          <label htmlFor="bk-email" style={labelSt}>Email <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional — for confirmation)</span></label>
          <input id="bk-email" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="you@email.com" style={inputSt} />
        </div>
        <div>
          <label htmlFor="bk-notes" style={labelSt}>Special requests <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
          <textarea id="bk-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Allergies, preferred pressure, therapist gender preference…" style={{ ...inputSt, resize: 'vertical' }} />
        </div>

        <TurnstileWidget onToken={setToken} />

        {errMsg && <p role="alert" style={{ font: '400 13px Inter,sans-serif', color: '#C0392B', margin: 0 }}>{errMsg}</p>}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
        <button type="button" onClick={() => setStep(2)} style={stepBtnSt(false)}>← Back</button>
        <button type="submit" disabled={submitting} style={{ ...stepBtnSt(true), opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
          {submitting ? 'Confirming…' : 'Confirm Booking'}
        </button>
      </div>
    </form>
  )

  // ── Step 4: Confirmed ──────────────────────────────────────────────────────
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#3B5249', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3 style={{ font: '400 30px Cormorant Garamond,serif', color: '#1C1917', margin: '16px 0 0' }}>Booking confirmed</h3>
      <div style={{ font: '400 32px/1 Cormorant Garamond,serif', color: '#3B5249', margin: '12px 0', letterSpacing: 2 }}>{refCode}</div>
      <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663', maxWidth: '34ch', margin: '0 auto' }}>
        {treatment?.name} · {duration} min<br />
        {formatDate(selDate)} at {selSlot}<br /><br />
        We will send a WhatsApp confirmation within minutes.
      </p>
      <button type="button" onClick={() => { setStep(1); setTreatment(null); setDuration(null); setSelDate(''); setSelSlot(''); setGuestName(''); setGuestPhone(''); setGuestEmail(''); setNotes(''); setToken(''); setRefCode('') }}
        style={{ marginTop: 20, ...stepBtnSt(false) }}>
        Make Another Booking
      </button>
    </div>
  )
}
