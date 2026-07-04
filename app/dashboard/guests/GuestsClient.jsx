'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { padding: '7px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer' }
const STATUS_COLORS = { pending: '#C4924A', confirmed: '#3B5249', completed: '#6B6663', cancelled: '#C0392B' }

const money = (n) => `฿${Math.round(n ?? 0).toLocaleString()}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—'

const StatusBadge = ({ status }) => (
  <span style={{
    background: (STATUS_COLORS[status] ?? '#6B6663') + '1A', color: STATUS_COLORS[status] ?? '#6B6663',
    padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'capitalize',
  }}>
    {status}
  </span>
)

export default function GuestsClient({ initialGuests }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openId = searchParams.get('id')

  const [guests, setGuests] = useState(initialGuests)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(openId)

  useEffect(() => { if (openId) setSelectedId(openId) }, [openId])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/guests?search=${encodeURIComponent(search)}`)
        const data = await res.json()
        if (res.ok) setGuests(data.guests ?? [])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const openGuest = (id) => {
    setSelectedId(id)
    router.replace(`/dashboard/guests?id=${id}`, { scroll: false })
  }
  const closeGuest = () => {
    setSelectedId(null)
    router.replace('/dashboard/guests', { scroll: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <input className="input" placeholder="Search name, phone, or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        {loading && <span style={{ marginLeft: 12, font: '400 12px Inter,sans-serif', color: '#9B9390' }}>Searching…</span>}
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>{guests.length} guest{guests.length === 1 ? '' : 's'}</h2>
        {guests.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No guests found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9B9390', font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px 10px' }}>Name</th>
                <th style={{ padding: '6px 8px 10px' }}>Phone</th>
                <th style={{ padding: '6px 8px 10px' }}>Bookings</th>
                <th style={{ padding: '6px 8px 10px' }}>Lifetime Spend</th>
                <th style={{ padding: '6px 8px 10px' }}>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {guests.map(g => (
                <tr key={g.id} onClick={() => openGuest(g.id)}
                  style={{ borderTop: '1px solid #F0ECE6', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 8px', font: '600 13px Inter,sans-serif', color: '#1C1917' }}>{g.full_name}</td>
                  <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{g.phone}</td>
                  <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{g.bookingCount}</td>
                  <td style={{ padding: '10px 8px', font: '600 13px Inter,sans-serif', color: '#3B5249' }}>{money(g.lifetimeSpend)}</td>
                  <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{fmtDate(g.lastVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && <GuestProfilePanel id={selectedId} onClose={closeGuest} onSaved={(g) => setGuests(gs => gs.map(x => x.id === g.id ? { ...x, ...g } : x))} />}
    </div>
  )
}

function GuestProfilePanel({ id, onClose, onSaved }) {
  const [guest, setGuest] = useState(null)
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/admin/guests/${id}`).then(r => r.json()).then(data => {
      if (cancelled) return
      if (data.error) { setError(data.error); return }
      setGuest(data.guest)
      setBookings(data.bookings)
      setStats(data.stats)
      setFullName(data.guest.full_name ?? '')
      setPhone(data.guest.phone ?? '')
      setEmail(data.guest.email ?? '')
      setNotes(data.guest.notes ?? '')
    }).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/guests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone, email, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setGuest(data.guest)
      setSaved(true)
      onSaved({ id, full_name: data.guest.full_name, phone: data.guest.phone, email: data.guest.email })
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FAF6F0', borderRadius: 12, padding: 0, maxWidth: 640, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: '#FAF6F0' }}>
          <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>{guest?.full_name ?? 'Guest Profile'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Loading…</p>}

          {!loading && stats && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatChip label="Bookings" value={stats.bookingCount} />
              <StatChip label="Completed" value={stats.completedCount} />
              <StatChip label="Cancelled" value={stats.cancelledCount} />
              <StatChip label="Lifetime Spend" value={money(stats.lifetimeSpend)} accent="#3B5249" />
              <StatChip label="Last Visit" value={fmtDate(stats.lastVisit)} />
            </div>
          )}

          {!loading && (
            <form onSubmit={handleSave} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={sectionTitle}>Essential Details</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Full name</label>
                  <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Phone</label>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>Notes (preferences, allergies, staff notes…)</label>
                <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && <span style={{ color: '#065F46', font: '500 12px Inter,sans-serif' }}>Saved ✓</span>}
              {error && <span style={{ color: '#DC2626', font: '400 12px Inter,sans-serif' }}>{error}</span>}
            </form>
          )}

          {!loading && (
            <div style={card}>
              <h2 style={sectionTitle}>Booking History</h2>
              {bookings.length === 0 ? (
                <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No bookings yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bookings.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F0ECE6', borderRadius: 6, padding: 10 }}>
                      <div>
                        <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917' }}>{b.spa_treatments?.name ?? '—'}</div>
                        <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{b.date} · {b.time_slot?.slice(0, 5)} · {b.ref_code}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ font: '600 12px Inter,sans-serif', color: '#3B5249' }}>{money(b.price)}</span>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, accent }) {
  return (
    <div style={{ ...card, padding: '10px 16px', flex: 1, minWidth: 100 }}>
      <div style={{ font: '600 9px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{label}</div>
      <div style={{ font: '400 20px Cormorant Garamond,serif', color: accent ?? '#1C1917', marginTop: 2 }}>{value}</div>
    </div>
  )
}
