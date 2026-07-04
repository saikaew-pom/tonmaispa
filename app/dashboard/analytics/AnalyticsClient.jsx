'use client'

import { useState, useEffect } from 'react'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnGhost = (active) => ({
  padding: '7px 14px', borderRadius: 6, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'),
  background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer',
})

const PERIODS = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const CHANNEL_LABELS = {
  'Organic Search': 'Google Search', Direct: 'Direct (typed URL)', Referral: 'Linked from another site',
  'Organic Social': 'Instagram/Facebook', 'Paid Search': 'Google Ads', Email: 'Email', Unassigned: 'Other',
}
const ACTION_LABELS = {
  book_now_click: 'Clicked "Book Now"', booking_complete: 'Completed a booking', whatsapp_click: 'Clicked WhatsApp',
  line_click: 'Clicked Line', enquiry_submit: 'Submitted an enquiry', chat_open: 'Opened the chatbot',
  map_click: 'Clicked directions/map', instagram_click: 'Clicked Instagram', review_click: 'Clicked reviews',
}
const DEVICE_LABELS = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' }

function shortPath(path) {
  if (path === '/') return 'Homepage'
  return path.length > 40 ? path.slice(0, 40) + '…' : path
}

function ChangeBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const up = pct > 0
  const color = pct === 0 ? '#9B9390' : up ? '#3B5249' : '#C0392B'
  return <span style={{ font: '600 11px Inter,sans-serif', color, marginLeft: 8 }}>{up ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct)}%</span>
}

function KpiCard({ label, value, changePct }) {
  return (
    <div style={{ ...card, padding: '14px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{label}</div>
      <div style={{ font: '400 26px Cormorant Garamond,serif', color: '#1C1917', marginTop: 4 }}>
        {value}<ChangeBadge pct={changePct} />
      </div>
    </div>
  )
}

function ListCard({ title, rows, labelKey, valueKey, labelMap, formatLabel }) {
  return (
    <div style={card}>
      <h2 style={sectionTitle}>{title}</h2>
      {(!rows || rows.length === 0) ? (
        <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No data for this period.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid #F0ECE6' : 'none', paddingTop: i > 0 ? 6 : 0 }}>
              <span style={{ font: '400 13px Inter,sans-serif', color: '#1C1917' }}>
                {formatLabel ? formatLabel(r[labelKey]) : (labelMap?.[r[labelKey]] ?? r[labelKey])}
              </span>
              <span style={{ font: '600 13px Inter,sans-serif', color: '#3B5249' }}>{r[valueKey]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsClient() {
  const [period, setPeriod] = useState('30d')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/admin/analytics?period=${period}`).then(r => r.json()).then(data => {
      if (cancelled) return
      if (data.error) { setError(data.error); setSummary(null); return }
      setSummary(data.summary)
    }).catch(() => !cancelled && setError('Could not load analytics data.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [period])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={btnGhost(period === p.value)}>{p.label}</button>
          ))}
        </div>
        {summary && (
          <a href={`/api/admin/analytics/export?period=${period}`} style={btnPrimary}>Download PDF</a>
        )}
      </div>

      {loading && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Loading…</p>}

      {error && (
        <div style={{ ...card, background: '#FEF2F2', borderColor: '#FCA5A5' }}>
          <p style={{ color: '#DC2626', font: '400 13px Inter,sans-serif', margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && summary && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard label="Visitors" value={summary.totals.activeUsers} changePct={summary.totals.activeUsersChangePct} />
            <KpiCard label="Sessions" value={summary.totals.sessions} changePct={summary.totals.sessionsChangePct} />
            <KpiCard label="New Visitors" value={summary.totals.newUsers} />
            <KpiCard label="Booking Conversion" value={`${summary.conversionRatePct}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <ListCard title="Where visitors came from" rows={summary.channels} labelKey="channel" valueKey="sessions" labelMap={CHANNEL_LABELS} />
            <ListCard title="Most-viewed pages" rows={summary.pages} labelKey="path" valueKey="views" formatLabel={shortPath} />
            <ListCard title="What visitors did" rows={summary.actions.filter(a => a.count > 0)} labelKey="name" valueKey="count" labelMap={ACTION_LABELS} />
            <ListCard title="Device" rows={summary.devices} labelKey="device" valueKey="sessions" labelMap={DEVICE_LABELS} />
            <ListCard title="Top visitor locations" rows={summary.countries} labelKey="country" valueKey="users" />
          </div>
        </>
      )}
    </div>
  )
}
