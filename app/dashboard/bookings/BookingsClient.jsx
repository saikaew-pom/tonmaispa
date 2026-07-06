'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']
const SOURCES  = ['online', 'walk_in', 'phone', 'chatbot']
const STATUS_COLORS = { pending: '#C4924A', confirmed: '#3B5249', completed: '#6B6663', cancelled: '#C0392B' }

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function formatSentAt(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday as start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toYMD(d)
}

const DATE_RANGE_OPTIONS = [
  { value: 'all',      label: 'All dates' },
  { value: 'today',    label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next2',    label: 'Next 2 days' },
  { value: 'next7',    label: 'Next 7 days' },
  { value: 'custom',   label: 'Custom range…' },
]

// Table-view-only date filter — calendar view has its own week navigation
// as its date mechanism, so this doesn't touch it.
function matchesDateRange(booking, dateRangeFilter, customStart, customEnd) {
  const todayYMD = toYMD(new Date())
  switch (dateRangeFilter) {
    case 'today':    return booking.date === todayYMD
    case 'tomorrow': return booking.date === daysFromToday(1)
    case 'next2':    return booking.date >= todayYMD && booking.date <= daysFromToday(2)
    case 'next7':    return booking.date >= todayYMD && booking.date <= daysFromToday(7)
    case 'custom':   return (!customStart || booking.date >= customStart) && (!customEnd || booking.date <= customEnd)
    default:         return true
  }
}

const inputSt = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 4, font: '400 13px Inter,sans-serif', color: '#1C1917' }
const labelSt = { display: 'block', font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6663', marginBottom: 5 }

function normalizeE164Input(phone) {
  const compact = String(phone ?? '').trim().replace(/[\s().-]/g, '')
  if (!compact) return ''
  return compact.startsWith('+') ? compact : `+${compact}`
}

function looksLikeE164(phone) {
  return /^\+[1-9]\d{6,14}$/.test(normalizeE164Input(phone))
}

function missingConfirmationFields({ guestName, guestPhone, guestEmail }) {
  const missing = []
  if (!guestName?.trim()) missing.push('guest name')
  if (!looksLikeE164(guestPhone)) missing.push('phone with country code, e.g. +66869643159')
  if (!guestEmail?.trim()) missing.push('email')
  return missing
}

export default function BookingsClient({ initialBookings, treatments, therapists, twilioEnabled = false, prefill = {} }) {
  const [bookings, setBookings]     = useState(initialBookings)
  const [view, setView]             = useState('calendar') // 'calendar' | 'table'
  const [statusFilter, setStatusFilter]     = useState('all')
  const [treatmentFilter, setTreatmentFilter] = useState('all')
  const [sourceFilter, setSourceFilter]     = useState('all')
  const [search, setSearch]         = useState('')
  const [savingId, setSavingId]     = useState(null)
  const [weekStart, setWeekStart]   = useState(() => getWeekStart(new Date()))
  const [showNew, setShowNew]       = useState(Boolean(prefill?.fromConversation))
  const [notifyingId, setNotifyingId] = useState(null) // `${id}:email` | `${id}:whatsapp`
  const [notifyError, setNotifyError] = useState(null)
  const [editingBooking, setEditingBooking] = useState(null)
  const [logsBookingId, setLogsBookingId]   = useState(null)
  const [dateRangeFilter, setDateRangeFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')
  const [sortDir, setSortDir]         = useState('asc') // table view's Date/Time column sort

  const patchBooking = (id, fields) => setBookings(prev => prev.map(b => b.id === id ? { ...b, ...fields } : b))

  const updateStatus = async (id, status) => {
    setSavingId(id)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) patchBooking(id, { status })
    setSavingId(null)
  }

  // Nothing notifies the guest automatically when status changes — staff
  // reviews the booking, then explicitly triggers a send so a guest is only
  // ever contacted once a human actually looked at it.
  const sendUpdateEmail = async (id) => {
    setNotifyingId(`${id}:email`)
    setNotifyError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${id}/notify`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setNotifyError(data.error || 'Could not send the email.'); return }
      patchBooking(id, { last_email_sent_at: data.last_email_sent_at, last_email_status: data.last_email_status })
    } finally {
      setNotifyingId(null)
    }
  }

  const sendWhatsApp = async (id) => {
    setNotifyingId(`${id}:whatsapp`)
    setNotifyError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${id}/whatsapp`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setNotifyError(data.error || 'Could not send the WhatsApp message.'); return }
      patchBooking(id, { last_whatsapp_sent_at: data.last_whatsapp_sent_at, last_whatsapp_status: data.last_whatsapp_status })
    } finally {
      setNotifyingId(null)
    }
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

  // Table view's own date-range + sort — calendar view keeps its week
  // navigation as its date mechanism, so this is scoped to the table only.
  const tableRows = useMemo(() => visible
    .filter(b => matchesDateRange(b, dateRangeFilter, customStart, customEnd))
    .sort((a, b) => {
      const cmp = `${a.date} ${a.time_slot}`.localeCompare(`${b.date} ${b.time_slot}`)
      return sortDir === 'asc' ? cmp : -cmp
    }), [visible, dateRangeFilter, customStart, customEnd, sortDir])

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
      {view === 'table' && (
        <>
          <select value={dateRangeFilter} onChange={e => setDateRangeFilter(e.target.value)} style={{ ...inputSt, maxWidth: 160, width: 'auto' }}>
            {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {dateRangeFilter === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ ...inputSt, maxWidth: 150, width: 'auto' }} />
              <span style={{ color: '#9B9390', font: '400 12px Inter,sans-serif' }}>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ ...inputSt, maxWidth: 150, width: 'auto' }} />
            </>
          )}
        </>
      )}
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

  const notifyProps = { notifyingId, twilioEnabled, onSendEmail: sendUpdateEmail, onSendWhatsApp: sendWhatsApp, onViewLogs: setLogsBookingId }

  return (
    <div>
      {prefill?.fromConversation && (
        <div style={{ background: '#F6EFE4', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ font: '700 12px Inter,sans-serif', color: '#3B5249' }}>
            Creating booking from WhatsApp conversation{prefill.guestName ? ` with ${prefill.guestName}` : ''}
          </div>
          <div style={{ marginTop: 3, font: '400 12px Inter,sans-serif', color: '#6B6663' }}>
            Name, email, and full phone number with country code are required before a booking can be confirmed.
          </div>
        </div>
      )}

      <FilterBar />

      {notifyError && (
        <div style={{ background: '#FBEAEA', border: '1px solid #E0B4B4', color: '#C0392B', borderRadius: 6, padding: '10px 14px', font: '500 12px Inter,sans-serif', marginBottom: 12 }}>
          {notifyError}
        </div>
      )}

      {view === 'calendar' ? (
        <CalendarView weekDays={weekDays} byDate={byDate} onShift={shiftWeek} onToday={() => setWeekStart(getWeekStart(new Date()))}
          savingId={savingId} onStatusChange={updateStatus} onEdit={setEditingBooking} {...notifyProps} />
      ) : (
        <TableView visible={tableRows} savingId={savingId} onStatusChange={updateStatus} onEdit={setEditingBooking}
          sortDir={sortDir} onToggleSort={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} {...notifyProps} />
      )}

      {showNew && (
        <NewBookingModal
          treatments={treatments}
          therapists={therapists}
          prefill={prefill}
          twilioEnabled={twilioEnabled}
          onClose={() => setShowNew(false)}
          onCreated={(b, options = {}) => { addBooking(b); if (!options.keepOpen) setShowNew(false) }}
          onBookingUpdated={patchBooking}
        />
      )}

      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          treatments={treatments}
          therapists={therapists}
          onClose={() => setEditingBooking(null)}
          onSaved={b => { patchBooking(b.id, b); setEditingBooking(null) }}
        />
      )}

      {logsBookingId && (
        <LogsModal bookingId={logsBookingId} onClose={() => setLogsBookingId(null)} />
      )}
    </div>
  )
}

// Send-email / send-WhatsApp / view-logs actions for one booking. Sent state
// is read straight off the booking row (persisted server-side), not local
// component state, so it survives a page reload.
function NotifyCell({ booking, notifyingId, twilioEnabled, onSendEmail, onSendWhatsApp, onViewLogs, compact }) {
  const canNotify = ['confirmed', 'cancelled'].includes(booking.status)
  const emailSending = notifyingId === `${booking.id}:email`
  const whatsappSending = notifyingId === `${booking.id}:whatsapp`
  // Only treat a past send as "done" if it reflected the CURRENT status —
  // if staff changes status again after sending, the button must reappear
  // so they can notify the guest of the new status too.
  const emailSentAt = booking.last_email_status === booking.status ? formatSentAt(booking.last_email_sent_at) : null
  const whatsappSentAt = booking.last_whatsapp_status === booking.status ? formatSentAt(booking.last_whatsapp_sent_at) : null

  const btnSt = {
    border: '1px solid #3B5249', borderRadius: 3, background: '#fff', color: '#3B5249',
    padding: compact ? '2px 4px' : '4px 9px', font: `500 ${compact ? 10 : 11}px Inter,sans-serif`,
    cursor: 'pointer', width: compact ? '100%' : 'auto',
  }
  const sentSt = { fontSize: compact ? 10 : 11, color: '#6B6663', lineHeight: 1.3 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: compact ? 4 : 0, alignItems: compact ? 'stretch' : 'flex-start' }}>
      {canNotify && booking.guest_email && (
        emailSentAt
          ? <div style={sentSt}>✓ Email sent {emailSentAt}</div>
          : <button type="button" disabled={emailSending} onClick={() => onSendEmail(booking.id)} style={{ ...btnSt, opacity: emailSending ? 0.6 : 1 }}>
              {emailSending ? 'Sending…' : 'Send update email'}
            </button>
      )}
      {canNotify && twilioEnabled && booking.guest_phone && (
        whatsappSentAt
          ? <div style={sentSt}>✓ WhatsApp sent {whatsappSentAt}</div>
          : <button type="button" disabled={whatsappSending} onClick={() => onSendWhatsApp(booking.id)} style={{ ...btnSt, opacity: whatsappSending ? 0.6 : 1 }}>
              {whatsappSending ? 'Sending…' : 'Send via WhatsApp'}
            </button>
      )}
      <button type="button" onClick={() => onViewLogs(booking.id)} style={{ ...btnSt, border: '1px solid var(--color-border)', color: '#6B6663' }}>
        View logs
      </button>
    </div>
  )
}

// ── Calendar (7-day week) view ──────────────────────────────────────────────
function CalendarView({ weekDays, byDate, onShift, onToday, savingId, onStatusChange, onEdit, ...notifyProps }) {
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
                  <div key={b.id} onClick={() => onEdit(b)} style={{ cursor: 'pointer', background: '#FAF6F0', borderLeft: `3px solid ${STATUS_COLORS[b.status]}`, borderRadius: 4, padding: '6px 8px' }}>
                    <div style={{ font: '600 11px Inter,sans-serif', color: '#1C1917' }}>{b.time_slot?.slice(0, 5)} · {b.guest_name}</div>
                    <div style={{ font: '400 10px Inter,sans-serif', color: '#6B6663', marginTop: 1 }}>{b.spa_treatments?.name ?? '—'}</div>
                    <select
                      value={b.status}
                      disabled={savingId === b.id}
                      onClick={e => e.stopPropagation()}
                      onChange={e => onStatusChange(b.id, e.target.value)}
                      style={{ marginTop: 4, width: '100%', border: '1px solid var(--color-border)', borderRadius: 3, padding: '2px 4px', font: '500 10px Inter,sans-serif', textTransform: 'capitalize', background: '#fff' }}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div onClick={e => e.stopPropagation()}>
                      <NotifyCell booking={b} compact {...notifyProps} />
                    </div>
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
function TableView({ visible, savingId, onStatusChange, onEdit, sortDir, onToggleSort, ...notifyProps }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#FAF6F0', textAlign: 'left' }}>
            {['Ref', 'Guest', 'Treatment', 'Date / Time', 'Source', 'Status', 'Notify'].map(h => (
              <th key={h} style={{ padding: '10px 14px', font: '600 11px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', color: '#9B9390' }}>
                {h === 'Date / Time' ? (
                  <button type="button" onClick={onToggleSort} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {h} <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  </button>
                ) : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(b => (
            <tr key={b.id} onClick={() => onEdit(b)} style={{ borderTop: '1px solid #F0ECE6', cursor: 'pointer' }}>
              <td style={{ padding: '12px 14px', font: '600 12px Inter,sans-serif', color: '#3B5249' }}>{b.ref_code}</td>
              <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }} onClick={e => b.customer_id && e.stopPropagation()}>
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
              <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                <select
                  value={b.status}
                  disabled={savingId === b.id}
                  onChange={e => onStatusChange(b.id, e.target.value)}
                  style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px', font: '500 12px Inter,sans-serif', textTransform: 'capitalize', background: '#fff' }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                <NotifyCell booking={b} {...notifyProps} />
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No bookings found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Booking audit log modal ─────────────────────────────────────────────────
function LogsModal({ bookingId, onClose }) {
  const [logs, setLogs]       = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/bookings/${bookingId}/logs`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setLogs(data.logs ?? []) })
      .catch(() => { if (!cancelled) setError('Could not load the activity log.') })
    return () => { cancelled = true }
  }, [bookingId])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ font: '400 20px Cormorant Garamond,serif', color: '#1C1917' }}>Booking Activity</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
        </div>

        {error && <p style={{ color: '#C0392B', font: '400 12px Inter,sans-serif' }}>{error}</p>}
        {!error && logs === null && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Loading…</p>}
        {logs?.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No activity recorded yet.</p>}

        {logs?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map(log => (
              <div key={log.id} style={{ borderLeft: '2px solid #E5E0D8', paddingLeft: 12 }}>
                <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917', textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</div>
                {log.detail && <div style={{ font: '400 12px Inter,sans-serif', color: '#6B6663', marginTop: 2 }}>{log.detail}</div>}
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 3 }}>
                  {log.actor_email ?? 'System'} · {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Manual booking creation modal ───────────────────────────────────────────
function NewBookingModal({ treatments, therapists, prefill = {}, twilioEnabled = false, onClose, onCreated, onBookingUpdated }) {
  const [guestName, setGuestName]   = useState(prefill.guestName ?? '')
  const [guestPhone, setGuestPhone] = useState(prefill.guestPhone ?? '')
  const [guestEmail, setGuestEmail] = useState(prefill.guestEmail ?? '')
  const [treatmentId, setTreatmentId] = useState(treatments[0]?.id ?? '')
  const [duration, setDuration]     = useState(treatments[0]?.duration_options?.[0] ?? 60)
  const [therapistId, setTherapistId] = useState('')
  const [date, setDate]             = useState(() => toYMD(new Date()))
  const [time, setTime]             = useState('10:00')
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [bookableTreatmentIds, setBookableTreatmentIds] = useState(() => treatments.map(t => t.id))
  const [loadingTreatments, setLoadingTreatments] = useState(false)
  const [treatmentsError, setTreatmentsError] = useState('')
  const [status, setStatus]         = useState('confirmed')
  const [source, setSource]         = useState(prefill.fromConversation ? 'chatbot' : 'phone')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [createdBooking, setCreatedBooking] = useState(null)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [whatsAppSentAt, setWhatsAppSentAt] = useState('')
  const [whatsAppError, setWhatsAppError] = useState('')
  // Set when the server rejects with SLOT_FULL — swaps the submit button
  // into an explicit "Book anyway (overbook)" confirmation.
  const [slotFull, setSlotFull]     = useState(false)

  const treatment = treatments.find(t => t.id === treatmentId)
  const durationOptions = treatment?.duration_options ?? [60]
  const bookableTreatmentIdSet = useMemo(() => new Set(bookableTreatmentIds), [bookableTreatmentIds])
  const bookableTreatments = useMemo(
    () => treatments.filter(t => bookableTreatmentIdSet.has(t.id)),
    [treatments, bookableTreatmentIdSet],
  )
  const canCreate = Boolean(time && availableSlots.length && !loadingSlots)

  useEffect(() => {
    let cancelled = false
    if (!date || !treatments.length) {
      setBookableTreatmentIds([])
      return
    }

    setLoadingTreatments(true)
    setTreatmentsError('')

    Promise.all(treatments.map(async t => {
      const durations = Array.isArray(t.duration_options) && t.duration_options.length ? t.duration_options : [60]
      for (const optionDuration of durations) {
        const params = new URLSearchParams({
          date,
          treatment_id: t.id,
          duration: String(optionDuration),
        })
        const res = await fetch(`/api/bookings/availability?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not check treatment availability')
        if (Array.isArray(json.slots) && json.slots.some(slot => slot.available)) return t.id
      }
      return null
    }))
      .then(results => {
        if (cancelled) return
        const ids = results.filter(Boolean)
        setBookableTreatmentIds(ids)
        if (!ids.length) {
          setTreatmentId('')
          setTime('')
          return
        }
        if (!ids.includes(treatmentId)) {
          const firstTreatment = treatments.find(t => t.id === ids[0])
          setTreatmentId(ids[0])
          setDuration(firstTreatment?.duration_options?.[0] ?? 60)
          setTime('')
        }
      })
      .catch(error => {
        if (cancelled) return
        setTreatmentsError(error.message)
        setBookableTreatmentIds(treatments.map(t => t.id))
      })
      .finally(() => {
        if (!cancelled) setLoadingTreatments(false)
      })

    return () => { cancelled = true }
  }, [date, treatments, treatmentId])

  useEffect(() => {
    let cancelled = false
    if (!treatmentId || !date || !duration) {
      setAvailableSlots([])
      setTime('')
      return
    }

    setLoadingSlots(true)
    setSlotsError('')

    const params = new URLSearchParams({
      date,
      treatment_id: treatmentId,
      duration: String(duration),
    })

    fetch(`/api/bookings/availability?${params.toString()}`)
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not check availability')
        return Array.isArray(json.slots) ? json.slots.filter(slot => slot.available) : []
      })
      .then(slots => {
        if (cancelled) return
        setAvailableSlots(slots)
        setSlotFull(false)
        if (!slots.length) {
          setTime('')
        } else if (!slots.some(slot => slot.time === time)) {
          setTime(slots[0].time)
        }
      })
      .catch(error => {
        if (cancelled) return
        setAvailableSlots([])
        setSlotsError(error.message)
        setTime('')
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => { cancelled = true }
  }, [treatmentId, date, duration, time])

  const handleTreatmentChange = (id) => {
    setSlotFull(false)
    setTreatmentId(id)
    const t = treatments.find(x => x.id === id)
    setDuration(t?.duration_options?.[0] ?? 60)
  }

  const handleSubmit = async (e, overbook = false) => {
    e.preventDefault()
    const normalizedPhone = normalizeE164Input(guestPhone)
    const missing = status === 'confirmed' ? missingConfirmationFields({ guestName, guestPhone: normalizedPhone, guestEmail }) : []
    if (missing.length) {
      setErr(`Cannot confirm booking yet. Required: ${missing.join(', ')}.`)
      return
    }
    if (!overbook && !canCreate) {
      setErr('Please choose an available time before creating the booking.')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName, guest_phone: normalizedPhone, guest_email: guestEmail,
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
      if (prefill.fromConversation) {
        setCreatedBooking(json.booking)
        setWhatsAppSentAt('')
        setWhatsAppError('')
        onCreated(json.booking, { keepOpen: true })
      } else {
        onCreated(json.booking)
      }
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setSaving(false)
    }
  }

  const sendCreatedBookingWhatsApp = async () => {
    if (!createdBooking?.id) return
    setSendingWhatsApp(true)
    setWhatsAppError('')
    try {
      const res = await fetch(`/api/admin/bookings/${createdBooking.id}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: prefill.conversationId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not send WhatsApp confirmation')
      setWhatsAppSentAt(json.last_whatsapp_sent_at)
      onBookingUpdated?.(createdBooking.id, {
        last_whatsapp_sent_at: json.last_whatsapp_sent_at,
        last_whatsapp_status: json.last_whatsapp_status,
      })
    } catch (error) {
      setWhatsAppError(error.message)
    } finally {
      setSendingWhatsApp(false)
    }
  }

  if (createdBooking) {
    const conversationHref = prefill.conversationId ? `/dashboard/conversations?thread=${encodeURIComponent(prefill.conversationId)}` : '/dashboard/conversations'
    const canSendWhatsApp = twilioEnabled && createdBooking.guest_phone && ['confirmed', 'cancelled'].includes(createdBooking.status)
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 24px 70px rgba(28,25,23,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ font: '400 24px Cormorant Garamond,serif', color: '#1C1917' }}>Booking created</div>
              <div style={{ marginTop: 5, font: '700 11px Inter,sans-serif', letterSpacing: 1.2, textTransform: 'uppercase', color: '#C4924A' }}>
                {createdBooking.ref_code}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ background: '#FBF8F3', border: '1px solid var(--color-border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ font: '700 13px Inter,sans-serif', color: '#1C1917' }}>{createdBooking.guest_name}</div>
            <div style={{ marginTop: 5, font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663' }}>
              {createdBooking.spa_treatments?.name || treatment?.name || 'Spa treatment'}<br />
              {createdBooking.date} at {createdBooking.time_slot?.slice(0, 5)} · {createdBooking.duration} min
            </div>
          </div>

          <div style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', marginBottom: 14 }}>
            Next: send the confirmation into the same WhatsApp conversation so the guest sees the booking details and the timeline stays complete.
          </div>

          {whatsAppError && <div style={{ background: '#FBEAEA', border: '1px solid #E0B4B4', color: '#C0392B', borderRadius: 6, padding: '9px 11px', font: '600 12px Inter,sans-serif', marginBottom: 12 }}>{whatsAppError}</div>}
          {whatsAppSentAt && <div style={{ background: '#E8EFEA', border: '1px solid #C9D8D0', color: '#3B5249', borderRadius: 6, padding: '9px 11px', font: '700 12px Inter,sans-serif', marginBottom: 12 }}>✓ WhatsApp confirmation sent and logged in the conversation.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {canSendWhatsApp && !whatsAppSentAt && (
              <button type="button" disabled={sendingWhatsApp} onClick={sendCreatedBookingWhatsApp} style={{ background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', font: '700 12px Inter,sans-serif', cursor: sendingWhatsApp ? 'wait' : 'pointer', opacity: sendingWhatsApp ? 0.7 : 1 }}>
                {sendingWhatsApp ? 'Sending confirmation…' : 'Send WhatsApp confirmation'}
              </button>
            )}
            {!canSendWhatsApp && (
              <div style={{ color: '#8A5B13', background: '#FFF3D8', borderRadius: 6, padding: '9px 11px', font: '600 12px/1.5 Inter,sans-serif' }}>
                WhatsApp sending is not available for this booking. Check Twilio settings and guest phone.
              </div>
            )}
            <a href={conversationHref} style={{ textAlign: 'center', textDecoration: 'none', background: '#fff', color: '#3B5249', border: '1px solid #3B5249', borderRadius: 6, padding: '10px 0', font: '700 12px Inter,sans-serif' }}>
              Back to conversation
            </a>
            <button type="button" onClick={onClose} style={{ background: '#fff', color: '#6B6663', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 0', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
              Stay on bookings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>New Booking</div>
            {prefill.fromConversation && (
              <div style={{ marginTop: 4, font: '500 11px Inter,sans-serif', color: '#C4924A' }}>From WhatsApp conversation</div>
            )}
          </div>
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
              <input required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} onBlur={() => setGuestPhone(normalizeE164Input(guestPhone))} title="Use full country code format, e.g. +66869643159" style={inputSt} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Email</label>
              <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} style={inputSt} />
            </div>
          </div>
          <div style={{ marginTop: -6, font: '400 11px/1.5 Inter,sans-serif', color: '#9B9390' }}>
            Confirmed bookings require guest name, email, and phone with country code.
          </div>

          <div>
            <label style={labelSt}>Treatment</label>
            <select required value={treatmentId} onChange={e => handleTreatmentChange(e.target.value)} disabled={loadingTreatments || bookableTreatments.length === 0} style={inputSt}>
              {bookableTreatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ marginTop: 5, font: '400 11px/1.5 Inter,sans-serif', color: treatmentsError ? '#C0392B' : '#9B9390' }}>
              {loadingTreatments
                ? 'Checking which treatments have open times on this date…'
                : treatmentsError
                  ? treatmentsError
                  : bookableTreatments.length
                    ? 'Only treatments with at least one available time on this date are shown.'
                    : 'No treatments have available times on this date. Try another date.'}
            </div>
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
              <select required value={time} onChange={e => { setSlotFull(false); setTime(e.target.value) }} disabled={loadingSlots || availableSlots.length === 0} style={inputSt}>
                {availableSlots.map(slot => (
                  <option key={slot.time} value={slot.time}>
                    {slot.time}{Number.isFinite(slot.spotsLeft) ? ` · ${slot.spotsLeft} spot${slot.spotsLeft === 1 ? '' : 's'} left` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: -6, font: '400 11px/1.5 Inter,sans-serif', color: slotsError ? '#C0392B' : '#9B9390' }}>
            {loadingSlots
              ? 'Checking real availability…'
              : slotsError
                ? slotsError
                : availableSlots.length
                  ? 'Only available times are shown for this treatment, date, and duration.'
                  : 'No available time for this treatment/date/duration. Choose another option.'}
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

          <button type="submit" disabled={saving || !canCreate} style={{ marginTop: 6, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', font: '600 12px Inter,sans-serif', cursor: saving ? 'wait' : 'pointer', opacity: saving || !canCreate ? 0.7 : 1 }}>
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

// ── Edit existing booking modal — click any booking to open ────────────────
function EditBookingModal({ booking, treatments, therapists, onClose, onSaved }) {
  const [guestName, setGuestName]   = useState(booking.guest_name ?? '')
  const [guestPhone, setGuestPhone] = useState(booking.guest_phone ?? '')
  const [guestEmail, setGuestEmail] = useState(booking.guest_email ?? '')
  const [treatmentId, setTreatmentId] = useState(booking.treatment_id ?? treatments[0]?.id ?? '')
  const [duration, setDuration]     = useState(booking.duration)
  const [therapistId, setTherapistId] = useState(booking.therapist_id ?? '')
  const [date, setDate]             = useState(booking.date)
  const [time, setTime]             = useState(booking.time_slot?.slice(0, 5) ?? '10:00')
  const [status, setStatus]         = useState(booking.status)
  const [source, setSource]         = useState(booking.source ?? 'phone')
  const [notes, setNotes]           = useState(booking.notes ?? '')
  const [staffNotes, setStaffNotes] = useState(booking.staff_notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [slotFull, setSlotFull]     = useState(false)

  const treatment = treatments.find(t => t.id === treatmentId)
  const durationOptions = treatment?.duration_options ?? [60]

  const handleTreatmentChange = (id) => {
    setSlotFull(false)
    setTreatmentId(id)
    const t = treatments.find(x => x.id === id)
    if (t && !(t.duration_options ?? []).includes(duration)) setDuration(t.duration_options?.[0] ?? 60)
  }

  const handleSubmit = async (e, overbook = false) => {
    e.preventDefault()
    const normalizedPhone = normalizeE164Input(guestPhone)
    const missing = status === 'confirmed' ? missingConfirmationFields({ guestName, guestPhone: normalizedPhone, guestEmail }) : []
    if (missing.length) {
      setErr(`Cannot confirm booking yet. Required: ${missing.join(', ')}.`)
      return
    }
    setSaving(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName, guest_phone: normalizedPhone, guest_email: guestEmail || null,
          treatment_id: treatmentId, therapist_id: therapistId || null,
          date, time_slot: time, duration, status, source,
          notes, staff_notes: staffNotes,
          overbook,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'SLOT_FULL') setSlotFull(true)
        throw new Error(json.error || 'Could not save changes')
      }
      onSaved(json.booking)
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
          <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>Edit Booking · {booking.ref_code}</div>
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
              <input required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} onBlur={() => setGuestPhone(normalizeE164Input(guestPhone))} title="Use full country code format, e.g. +66869643159" style={inputSt} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Email</label>
              <input required={status === 'confirmed'} type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} style={inputSt} />
            </div>
          </div>
          <div style={{ marginTop: -6, font: '400 11px/1.5 Inter,sans-serif', color: '#9B9390' }}>
            Confirmed bookings require guest name, email, and phone with country code.
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
            <label style={labelSt}>Guest notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelSt}>Staff note (internal only)</label>
            <textarea value={staffNotes} onChange={e => setStaffNotes(e.target.value)} rows={2} placeholder="Not visible to the guest…" style={{ ...inputSt, resize: 'vertical' }} />
          </div>

          {err && <p style={{ color: '#C0392B', font: '400 12px Inter,sans-serif', margin: 0 }}>{err}</p>}

          <button type="submit" disabled={saving} style={{ marginTop: 6, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', font: '600 12px Inter,sans-serif', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {slotFull && (
            <button type="button" disabled={saving} onClick={e => handleSubmit(e, true)}
              style={{ background: '#fff', color: '#C0392B', border: '1px solid #C0392B', borderRadius: 6, padding: '10px 0', font: '600 12px Inter,sans-serif', cursor: saving ? 'wait' : 'pointer' }}>
              Save anyway (overbook this slot)
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
