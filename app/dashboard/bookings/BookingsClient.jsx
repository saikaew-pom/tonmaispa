'use client'

import { useState } from 'react'

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']

export default function BookingsClient({ initialBookings }) {
  const [bookings, setBookings] = useState(initialBookings)
  const [filter, setFilter] = useState('all')
  const [savingId, setSavingId] = useState(null)

  const updateStatus = async (id, status) => {
    setSavingId(id)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    }
    setSavingId(null)
  }

  const visible = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '6px 14px', borderRadius: 999, border: '1px solid var(--color-border)',
            background: filter === s ? '#3B5249' : '#fff', color: filter === s ? '#fff' : '#1C1917',
            font: '500 12px Inter,sans-serif', cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {s}
          </button>
        ))}
      </div>

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
                  <div style={{ fontWeight: 600 }}>{b.guest_name}</div>
                  <div style={{ color: '#9B9390', fontSize: 12 }}>{b.guest_phone}</div>
                </td>
                <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }}>{b.spa_treatments?.name ?? '—'} <span style={{ color: '#9B9390' }}>({b.duration}min)</span></td>
                <td style={{ padding: '12px 14px', font: '400 13px Inter,sans-serif' }}>{b.date} · {b.time_slot?.slice(0,5)}</td>
                <td style={{ padding: '12px 14px', font: '400 12px Inter,sans-serif', color: '#6B6663', textTransform: 'capitalize' }}>{b.source}</td>
                <td style={{ padding: '12px 14px' }}>
                  <select
                    value={b.status}
                    disabled={savingId === b.id}
                    onChange={e => updateStatus(b.id, e.target.value)}
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
    </div>
  )
}
