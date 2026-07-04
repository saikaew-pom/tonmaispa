'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']
const SOURCES  = ['online', 'walk_in', 'phone', 'chatbot']
const STATUS_COLORS = { pending: '#C4924A', confirmed: '#3B5249', completed: '#6B6663', cancelled: '#C0392B' }

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday as start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const inputSt = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 4, font: '400 13px Inter,sans-serif', color: '#1C1917' }
const labelSt = { display: 'block', font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6663', marginBottom: 5 }

export default function BookingsClient({ initialBookings, treatments, therapists }) {
  const [bookings, setBookings]     = useState(initialBookings)
  const [view, setView]             = useState('calendar') // 'calendar' | 'table'
  const [statusFilter, setStatusFilter]     = useState('all')
  const [treatmentFilter, setTreatmentFilter] = useState('all')
  const [sourceFilter, setSourceFilter]     = useState('all')
  const [search, setSearch]         = useState('')
  const [savingId, setSavingId]     = useState(null)
  const [weekStart, setWeekStart]   = useState(() => getWeekStart(new Date()))
  const [showNew, setShowNew]       = useState(false)

  const updateStatus = async (id, status) => {
    setSavingId(id)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    setSavingId(null)
  }

  const visible = useMemo(() => bookings
    .filter(b => statusFilter === 'all' || b.status === statusFilter)
    .filter(b => treatmentFilter === 'all' || b.treatment_id === treatmentFilter)
    .filter(b => sourceFilter === 'all' || b.source === sourceFilter)
    .filter(b => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return b.guest_name?.toLowerCase().includes(q) || b.guest_phone?.includes(q) || b.ref_code?.toLowerCase().includes(q)
    }), [bookings, statusFilter, treatmentFilter, sourceFilter, search])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  }), [weekStart])

  const byDate = useMemo(() => {
    const map = {}
    for (const b of visible) (map[b.date] ??= []).push(b)
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.time_slot.localeCompare(b.time_slot))
    return map
  }, [visible])

  const shiftWeek = (dir) => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d })

  const addBooking = (booking) => setBookings(prev => [booking, ...prev])

  const FilterBar = () => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
      <input placeholder="Search name, phone, ref…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, maxWidth: 200 }} />
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, maxWidth: 150, width: 'auto' }}>
        <option value="all">All statuses</option>
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={treatmentFilter} onChange={e => setTreatmentFilter(e.target.value)} style={{ ...inputSt, maxWidth: 200, width: 'auto' }}>
        <option value="all">All treatments</option>
        {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ ...inputSt, maxWidth: 150, width: 'auto' }}>
        <option value="all">All sources</option>
        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
        {['calendar', 'table'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '8px 16px', border: 'none', background: view === v ? '#3B5249' : '#fff', color: view === v ? '#fff' : '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer', textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>
      <button onClick={() => setShowNew(true)} style={{ background: '#C4924A', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
        + New Booking
      </button>
    </div>
  )

  return (
    <div>
      <FilterBar />

      {view === 'calendar' ? (
        <CalendarView weekDays={weekDays} byDate={byDate} onShift={shiftWeek} onToday={() => setWeekStart(getWeekStart(new Date()))}
          savingId={savingId} onStatusChange={updateStatus} />
      ) : (
        <TableView visible={visible} savingId={savingId} onStatusChange={updateStatus} />
      )}

      {showNew && (
        <NewBookingModal
          treatments={treatments}
          therapists={therapists}
          onClose={() => setShowNew(false)}
          onCreated={b => { addBooking(b); setShowNew(false) }}
        />
      )}
    </div>
  )
}

// ── Calendar (7-day week) view ──────────────────────────────────────────────
function CalendarView({ weekDays, byDate, onShift, onToday, savingId, onStatusChange }) {
  const monthLabel = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayYMD = toYMD(new Date())

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ font: '400 20px Cormorant Garamond,serif', color: '#1C1917' }}>{monthLabel}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onShift(-1)} style={navBtnSt}>← Prev</button>
          <button onClick={onToday} style={navBtnSt}>Today</button>
          <button onClick={() => onShift(1)} style={navBtnSt}>Next →</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {weekDays.map(d => {
          const ymd = toYMD(d)
          const dayBookings = byDate[ymd] ?? []
          const isToday = ymd === todayYMD
          return (
            <div key={ymd} style={{ background: '#fff', border: `1px solid ${isToday ? '#3B5249' : 'var(--color-border)'}`, borderRadius: 8, minHeight: 200, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #F0ECE6', background: isToday ? '#F0F4F2' : '#FAF6F0' }}>
                <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div style={{ font: '400 18px Cormorant Garamond,serif', color: isToday ? '#3B5249' : '#1C1917' }}>{d.getDate()}</div>
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {dayBookings.length === 0 && (
                  <div style={{ font: '400 11px Inter,sans-serif', color: '#C8C3BC', padding: '6px 4px' }}>—</div>
                )}
                {dayBookings.map(b => (
                  <div key={b.id} style={{ background: '#FAF6F0', borderLeft: `3px solid ${STATUS_COLORS[b.status]}`, borderRadius: 4, padding: '6px 8px' }}>
                    <div style={{ font: '600 11px Inter,sans-serif', color: '#1C1917' }}>{b.time_slot?.slice(0, 5)} · {b.guest_name}</div>
                    <div style={{ font: '400 10px Inter,sans-serif', color: '#6B6663', marginTop: 1 }}>{b.spa_treatments?.name ?? '—'}</div>
                    <select
                      value={b.status}
                      disabled={savingId === b.id}
                      onChange={e => onStatusChange(b.id, e.target.value)}
                      style={{ marginTop: 4, width: '100%', border: '1px solid var(--color-border)', borderRadius: 3, padding: '2px 4px', font: '500 10px Inter,sans-serif', textTransform: 'capitalize', background: '#fff' }}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnSt = { padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff', font: '500 11px Inter,sans-serif', cursor: 'pointer' }

// ── Table view ───────────────────────────────────────────────────────────────
function TableView({ visible, savingId, onStatusChange }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#FAF6F0', textAlign: 'left' }}>
            {['Ref', 'Guest', 'Treatment', 'Date / Time', 'Source', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 14px', font: '600 11px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', color: '#9B9390' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(b => (
            <tr key={b.id} style={{ borderTop: '1px solid #F0ECE6' }}>
              <td style={{ padding: '12px 14px', font: '600 12px Inter,sans-serif', color: '#3B5249' }}>{b.ref_code}</td>
              <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }}>
                {b.customer_id ? (
                  <Link href={`/dashboard/customers?id=${b.customer_id}`} style={{ fontWeight: 600, color: '#3B5249', textDecoration: 'none' }}>{b.guest_name}</Link>
                ) : (
                  <div style={{ fontWeight: 600 }}>{b.guest_name}</div>
                )}
                <div style={{ color: '#9B9390', fontSize: 12 }}>{b.guest_phone}</div>
              </td>
              <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }}>{b.spa_treatments?.name ?? '—'} <span style={{ color: '#9B9390' }}>({b.duration}min)</span></td>
              <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }}>{b.date} · {b.time_slot?.slice(0,5)}</td>
              <td style={{ padding: '12px 14px', font: '400 12px Inter,sans-serif', color: '#6B6663', textTransform: 'capitalize' }}>{b.source}</td>
              <td style={{ padding: '12px 14px' }}>
                <select
                  value={b.status}
                  disabled={savingId === b.id}
                  onChange={e => onStatusChange(b.id, e.target.value)}
                  style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px', font: '500 12px Inter,sans-serif', textTransform: 'capitalize', background: '#fff' }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No bookings found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Manual booking creation modal ───────────────────────────────────────────
function NewBookingModal({ treatments, therapists, onClose, onCreated }) {
  const [guestName, setGuestName]   = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [treatmentId, setTreatmentId] = useState(treatments[0]?.id ?? '')
  const [duration, setDuration]     = useState(treatments[0]?.duration_options?.[0] ?? 60)
  const [therapistId, setTherapistId] = useState('')
  const [date, setDate]             = useState(() => toYMD(new Date()))
  const [time, setTime]             = useState('10:00')
  const [status, setStatus]         = useState('confirmed')
  const [source, setSource]         = useState('phone')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  // Set when the server rejects with SLOT_FULL — swaps the submit button
  // into an explicit "Book anyway (overbook)" confirmation.
  const [slotFull, setSlotFull]     = useState(false)

  const treatment = treatments.find(t => t.id === treatmentId)
  const durationOptions = treatment?.duration_options ?? [60]

  const handleTreatmentChange = (id) => {
    setSlotFull(false)
    setTreatmentId(id)
    const t = treatments.find(x => x.id === id)
    setDuration(t?.duration_options?.[0] ?? 60)
  }

  const handleSubmit = async (e, overbook = false) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName, guest_phone: guestPhone, guest_email: guestEmail,
          treatment_id: treatmentId, therapist_id: therapistId || null,
          date, time_slot: time, duration, status, source, notes,
          overbook,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'SLOT_FULL') setSlotFull(true)
        throw new Error(json.error || 'Could not create booking')
      }
      onCreated(json.booking)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>New Booking</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelSt}>Guest name</label>
            <input required value={guestName} onChange={e => setGuestName(e.target.value)} style={inputSt} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Phone</label>
              <input required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} style={inputSt} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Email (optional)</label>
              <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} style={inputSt} />
            </div>
          </div>

          <div>
            <label style={labelSt}>Treatment</label>
            <select required value={treatmentId} onChange={e => handleTreatmentChange(e.target.value)} style={inputSt}>
              {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Duration</label>
              <select value={duration} onChange={e => { setSlotFull(false); setDuration(parseInt(e.target.value, 10)) }} style={inputSt}>
                {durationOptions.map(d => <option key={d} value={d}>{d} min{treatment?.prices?.[String(d)] ? ` · ฿${treatment.prices[String(d)]}` : ''}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Therapist (optional)</label>
              <select value={therapistId} onChange={e => setTherapistId(e.target.value)} style={inputSt}>
                <option value="">Unassigned</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Date</label>
              <input required type="date" value={date} onChange={e => { setSlotFull(false); setDate(e.target.value) }} style={inputSt} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Time</label>
              <input required type="time" value={time} onChange={e => { setSlotFull(false); setTime(e.target.value) }} style={inputSt} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputSt}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Source</label>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputSt}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelSt}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          {err && <p style={{ color: '#C0392B', font: '400 12px Inter,sans-serif', margin: 0 }}>{err}</p>}

          <button type="submit" disabled={saving} style={{ marginTop: 6, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', font: '600 12px Inter,sans-serif', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Booking'}
          </button>
          {slotFull && (
            <button type="button" disabled={saving} onClick={e => handleSubmit(e, true)}
              style={{ background: '#fff', color: '#C0392B', border: '1px solid #C0392B', borderRadius: 6, padding: '10px 0', font: '600 12px Inter,sans-serif', cursor: saving ? 'wait' : 'pointer' }}>
              Book anyway (overbook this slot)
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
