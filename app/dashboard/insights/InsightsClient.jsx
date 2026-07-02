'use client'

import { useState } from 'react'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = (active) => ({ padding: '7px 14px', borderRadius: 999, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'), background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer' })
const PRIORITY_COLORS = { high: '#C0392B', medium: '#C4924A', low: '#6B6663' }

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toYMD(d) }
const money = (n) => `฿${(n ?? 0).toLocaleString()}`

export default function InsightsClient({ defaultRange, revenue: initRevenue, therapistUtilization: initUtil, history: initHistory }) {
  const [preset, setPreset] = useState(30)
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [revenue, setRevenue] = useState(initRevenue)
  const [therapistUtilization, setTherapistUtilization] = useState(initUtil)
  const [recommendations, setRecommendations] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(initHistory)
  const [viewingId, setViewingId] = useState(null)

  const applyPreset = (days) => {
    setPreset(days)
    setStartDate(daysAgo(days))
    setEndDate(toYMD(new Date()))
  }

  const avgOccupancy = therapistUtilization.length
    ? Math.round(therapistUtilization.reduce((s, t) => s + t.occupancyPct, 0) / therapistUtilization.length)
    : 0

  const askForRecommendations = async () => {
    setLoading(true)
    setError('')
    setViewingId(null)
    try {
      const res = await fetch('/api/admin/insights/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate recommendations')
      setRevenue(data.summary.revenue)
      setTherapistUtilization(data.summary.therapistUtilization)
      setRecommendations(data.recommendations)
      if (data.id) setHistory(h => [{ id: data.id, period_start: startDate, period_end: endDate, created_at: new Date().toISOString() }, ...h])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const viewHistoryItem = async (id) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/insights?id=${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load this recommendation')
      setRevenue(data.insight.input_summary.revenue)
      setTherapistUtilization(data.insight.input_summary.therapistUtilization)
      setRecommendations(data.insight.recommendations)
      setStartDate(data.insight.period_start)
      setEndDate(data.insight.period_end)
      setViewingId(id)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const InsightList = ({ title, items }) => (
    <div style={card}>
      <h2 style={sectionTitle}>{title}</h2>
      {(!items || !items.length) && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No insights yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(items ?? []).map((ins, i) => (
          <div key={i} style={{ border: '1px solid #F0ECE6', borderRadius: 6, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>{ins.title}</div>
              <span style={{ flexShrink: 0, font: '600 9px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: PRIORITY_COLORS[ins.priority] ?? '#6B6663' }}>{ins.priority}</span>
            </div>
            <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663', margin: '8px 0 0' }}>{ins.detail}</p>
            {ins.suggestedAction && (
              <p style={{ font: '600 12px/1.5 Inter,sans-serif', color: '#3B5249', margin: '8px 0 0' }}>→ {ins.suggestedAction}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Date range + KPIs */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => applyPreset(d)} style={btnGhost(preset === d)}>Last {d} days</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" type="date" value={startDate} onChange={e => { setPreset(null); setStartDate(e.target.value) }} style={{ maxWidth: 150 }} />
              <span style={{ color: '#9B9390' }}>–</span>
              <input className="input" type="date" value={endDate} onChange={e => { setPreset(null); setEndDate(e.target.value) }} style={{ maxWidth: 150 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>Revenue</div>
              <div style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', marginTop: 2 }}>{money(revenue.totalRevenue)}</div>
              <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{revenue.bookingCount} completed bookings</div>
            </div>
            <div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>Therapist Occupancy</div>
              <div style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', marginTop: 2 }}>{avgOccupancy}%</div>
              <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>avg across {therapistUtilization.length} therapists</div>
            </div>
            <div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>Avg Booking Value</div>
              <div style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', marginTop: 2 }}>{money(revenue.avgBookingValue)}</div>
              <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{revenue.cancellationRate}% cancellation rate</div>
            </div>
          </div>

          <button onClick={askForRecommendations} disabled={loading} style={{ ...btnPrimary, marginTop: 18, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Analyzing…' : 'Ask for Recommendations'}
          </button>
          {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
        </div>

        {recommendations && (
          <>
            <InsightList title="Revenue Perspective" items={recommendations.revenueInsights} />
            <InsightList title="Marketing Perspective" items={recommendations.marketingInsights} />
          </>
        )}
      </div>

      {/* History */}
      <div style={card}>
        <h2 style={sectionTitle}>Past Requests</h2>
        {history.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No recommendations generated yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map(h => (
            <button key={h.id} onClick={() => viewHistoryItem(h.id)}
              style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid ' + (viewingId === h.id ? '#3B5249' : '#F0ECE6'),
                background: viewingId === h.id ? '#F0F4F2' : '#fff',
              }}>
              <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917' }}>{h.period_start} → {h.period_end}</div>
              <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{new Date(h.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
