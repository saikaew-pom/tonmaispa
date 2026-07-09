'use client'

import { useEffect, useMemo, useState } from 'react'

const inputSt = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  border: '1px solid #D8CFC3',
  borderRadius: 8,
  font: '400 16px Inter,sans-serif',
  color: '#1C1917',
  background: '#fff',
}

const labelSt = {
  display: 'block',
  marginBottom: 6,
  font: '700 11px Inter,sans-serif',
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: '#6B6663',
}

const buttonSt = {
  width: '100%',
  border: 'none',
  borderRadius: 8,
  padding: '14px 18px',
  background: '#3B5249',
  color: '#fff',
  font: '800 13px Inter,sans-serif',
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  cursor: 'pointer',
}

// "Today" at the spa (Asia/Bangkok), not in the visitor's browser timezone.
// A foreign guest whose phone is still on their home time would otherwise get a
// min/default date off by a day — blocking same-day booking or defaulting to a
// date already past in Thailand. en-CA yields YYYY-MM-DD.
function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

function normalizePhone(value) {
  const compact = String(value ?? '').trim().replace(/[\s().-]/g, '')
  if (!compact) return ''
  return compact.startsWith('+') ? compact : `+${compact}`
}

export default function BookingRequestClient({ token, treatments, initialGuest }) {
  const firstTreatment = treatments[0] ?? null
  const [guestName, setGuestName] = useState(initialGuest?.name ?? '')
  const [guestPhone, setGuestPhone] = useState(initialGuest?.phone ?? '')
  const [guestEmail, setGuestEmail] = useState(initialGuest?.email ?? '')
  const [treatmentId, setTreatmentId] = useState(firstTreatment?.id ?? '')
  const selectedTreatment = useMemo(() => treatments.find(t => t.id === treatmentId) ?? firstTreatment, [treatments, treatmentId, firstTreatment])
  const durationOptions = useMemo(
    () => selectedTreatment?.duration_options?.length ? selectedTreatment.duration_options : [60],
    [selectedTreatment],
  )
  const [duration, setDuration] = useState(durationOptions[0] ?? 60)
  const [date, setDate] = useState(todayYmd())
  const [timeSlot, setTimeSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState([])
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!durationOptions.includes(duration)) setDuration(durationOptions[0] ?? 60)
  }, [durationOptions, duration])

  useEffect(() => {
    if (!treatmentId || !date || !duration) return
    let cancelled = false
    setChecking(true)
    setTimeSlot('')
    setSlots([])
    fetch(`/api/bookings/availability?${new URLSearchParams({ treatment_id: treatmentId, date, duration: String(duration) })}`)
      .then(res => res.json().then(json => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return
        if (!ok) throw new Error(json.error || 'Could not check availability')
        setSlots(json.slots ?? [])
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Could not check availability')
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [treatmentId, date, duration])

  const availableSlots = slots.filter(slot => slot.available)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)

    const phone = normalizePhone(guestPhone)
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError('Please enter your phone with country code, e.g. +66869643159.')
      return
    }
    if (!timeSlot) {
      setError('Please choose an available time.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          guest_name: guestName,
          guest_phone: phone,
          guest_email: guestEmail,
          treatment_id: treatmentId,
          date,
          time_slot: timeSlot,
          duration: Number(duration),
          notes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not save your booking request.')
      setSuccess(json.booking)
    } catch (err) {
      setError(err.message || 'Could not save your booking request.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <section style={{ background: '#fff', border: '1px solid #D8CFC3', borderRadius: 16, padding: 24 }}>
        <div style={{ font: '700 12px Inter,sans-serif', letterSpacing: 2, color: '#C4924A' }}>{success.ref_code}</div>
        <h2 style={{ margin: '8px 0 10px', font: '400 34px/1 Cormorant Garamond,serif' }}>Request received</h2>
        <p style={{ margin: 0, font: '400 16px/1.6 Inter,sans-serif', color: '#6B6663' }}>
          Thank you. We received your request for {success.treatment} on {success.date} at {success.time}.
          Our team will confirm it on WhatsApp shortly.
        </p>
      </section>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #D8CFC3', borderRadius: 16, padding: 24 }}>
      {error && (
        <div style={{ marginBottom: 16, border: '1px solid #E0B4B4', background: '#FBEAEA', color: '#C0392B', borderRadius: 8, padding: 12, font: '600 14px/1.5 Inter,sans-serif' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Guest name">
          <input required value={guestName} onChange={e => setGuestName(e.target.value)} style={inputSt} placeholder="Your name" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Phone">
            <input required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} style={inputSt} placeholder="+66869643159" />
          </Field>
          <Field label="Email">
            <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} style={inputSt} placeholder="you@example.com" />
          </Field>
        </div>

        <Field label="Treatment">
          <select required value={treatmentId} onChange={e => setTreatmentId(e.target.value)} style={inputSt}>
            {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Field label="Duration">
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={inputSt}>
              {durationOptions.map(d => (
                <option key={d} value={d}>
                  {d} min{selectedTreatment?.prices?.[String(d)] ? ` · ฿${selectedTreatment.prices[String(d)]}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input required type="date" min={todayYmd()} value={date} onChange={e => setDate(e.target.value)} style={inputSt} />
          </Field>
        </div>

        <Field label="Available time">
          {checking ? (
            <div style={{ font: '500 14px Inter,sans-serif', color: '#6B6663' }}>Checking available times…</div>
          ) : availableSlots.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availableSlots.map(slot => (
                <button
                  type="button"
                  key={slot.time}
                  onClick={() => setTimeSlot(slot.time)}
                  style={{
                    border: `1px solid ${timeSlot === slot.time ? '#3B5249' : '#D8CFC3'}`,
                    borderRadius: 999,
                    padding: '9px 13px',
                    background: timeSlot === slot.time ? '#3B5249' : '#fff',
                    color: timeSlot === slot.time ? '#fff' : '#1C1917',
                    font: '700 13px Inter,sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ font: '600 14px/1.5 Inter,sans-serif', color: '#8A5A14', background: '#FFF3D8', borderRadius: 8, padding: 12 }}>
              No available time for this treatment/date. Please choose another date or duration.
            </div>
          )}
        </Field>

        <Field label="Note optional">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputSt, minHeight: 90, resize: 'vertical' }} placeholder="Any special request?" />
        </Field>

        <button disabled={saving || !timeSlot} type="submit" style={{ ...buttonSt, opacity: saving || !timeSlot ? 0.6 : 1, cursor: saving || !timeSlot ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Sending request…' : 'Confirm booking request'}
        </button>

        <p style={{ margin: 0, font: '400 13px/1.5 Inter,sans-serif', color: '#8A817B' }}>
          After you submit, Ton Mai Spa staff will review and confirm your booking by WhatsApp.
        </p>
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <label>
      <span style={labelSt}>{label}</span>
      {children}
    </label>
  )
}
