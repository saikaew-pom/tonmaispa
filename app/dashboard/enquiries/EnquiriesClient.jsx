'use client'

import { useState } from 'react'

const STATUSES = ['new', 'replied', 'closed']

export default function EnquiriesClient({ initialEnquiries }) {
  const [enquiries, setEnquiries] = useState(initialEnquiries)
  const [filter, setFilter] = useState('all')
  const [savingId, setSavingId] = useState(null)

  const updateStatus = async (id, status) => {
    setSavingId(id)
    const res = await fetch(`/api/admin/enquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    }
    setSavingId(null)
  }

  const visible = filter === 'all' ? enquiries : enquiries.filter(e => e.status === filter)

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(e => (
          <div key={e.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ font: '600 14px Inter,sans-serif' }}>{e.name || 'Unnamed guest'}</div>
                <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>
                  {e.phone} {e.email ? `· ${e.email}` : ''} · <span style={{ textTransform: 'capitalize' }}>{e.source}</span> · {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
              <select
                value={e.status}
                disabled={savingId === e.id}
                onChange={ev => updateStatus(e.id, ev.target.value)}
                style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 8px', font: '500 12px Inter,sans-serif', textTransform: 'capitalize', background: '#fff', flexShrink: 0 }}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {e.message && <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#4A4745', marginTop: 10 }}>{e.message}</p>}
            {e.metadata?.treatment_interest && (
              <div style={{ marginTop: 8, font: '400 12px Inter,sans-serif', color: '#6B6663' }}>
                Interested in: <strong>{e.metadata.treatment_interest}</strong>
                {e.metadata.preferred_date && ` · ${e.metadata.preferred_date}`}
                {e.metadata.preferred_time && ` ${e.metadata.preferred_time}`}
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9B9390', font: '400 13px Inter,sans-serif', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            No enquiries found.
          </div>
        )}
      </div>
    </div>
  )
}
