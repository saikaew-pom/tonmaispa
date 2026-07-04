'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnGhost = (active) => ({
  padding: '7px 14px', borderRadius: 6, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'),
  background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer',
})

const CHART_COLORS = ['#3B5249', '#C4924A', '#6E8B7F', '#D9B98A', '#8C6D4F', '#A8BDB4', '#E8D5B7']

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
  book_now_click: '👉 Clicked "Book Now"', booking_complete: '✅ Completed a booking', whatsapp_click: '💬 Clicked WhatsApp',
  line_click: '💬 Clicked Line', enquiry_submit: '📩 Submitted an enquiry', chat_open: '🤖 Opened the chatbot',
  map_click: '📍 Clicked directions/map', instagram_click: '📷 Clicked Instagram', review_click: '⭐ Clicked reviews',
}
const DEVICE_LABELS = { mobile: '📱 Mobile', desktop: '🖥️ Desktop', tablet: '📟 Tablet' }
const DEVICE_ICONS = { mobile: '📱', desktop: '🖥️', tablet: '📟' }

function shortPath(path) {
  if (path === '/' || path === '/en') return 'Homepage'
  return path.length > 30 ? path.slice(0, 30) + '…' : path
}

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1C1917', color: '#FAF6F0', padding: '8px 12px', borderRadius: 6, font: '500 12px Inter,sans-serif' }}>
      <div style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i}>{p.name}: {p.value}</div>)}
    </div>
  )
}

function ChangeBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const up = pct > 0
  const color = pct === 0 ? '#9B9390' : up ? '#3B5249' : '#C0392B'
  return <span style={{ font: '600 12px Inter,sans-serif', color, marginLeft: 8 }}>{up ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct)}%</span>
}

function KpiCard({ icon, label, value, changePct, accent }) {
  return (
    <div style={{ ...card, padding: '16px 20px', flex: 1, minWidth: 150, borderTop: `3px solid ${accent ?? '#3B5249'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{label}</span>
      </div>
      <div style={{ font: '400 30px Cormorant Garamond,serif', color: '#1C1917', marginTop: 6 }}>
        {value}<ChangeBadge pct={changePct} />
      </div>
    </div>
  )
}

function BarListCard({ title, icon, rows, labelKey, valueKey, labelMap, formatLabel }) {
  const max = Math.max(1, ...(rows ?? []).map(r => r[valueKey]))
  return (
    <div style={card}>
      <h2 style={sectionTitle}>{icon} {title}</h2>
      {(!rows || rows.length === 0) ? (
        <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No data for this period.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 12px Inter,sans-serif', color: '#1C1917', marginBottom: 3 }}>
                <span>{formatLabel ? formatLabel(r[labelKey]) : (labelMap?.[r[labelKey]] ?? r[labelKey])}</span>
                <span style={{ fontWeight: 700, color: '#3B5249' }}>{r[valueKey]}</span>
              </div>
              <div style={{ background: '#F0ECE6', borderRadius: 999, height: 6 }}>
                <div style={{ width: `${(r[valueKey] / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 999, height: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InterpretationCard({ period }) {
  const [interp, setInterp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setInterp(null)
    fetch(`/api/admin/analytics/interpret?period=${period}`).then(r => r.json()).then(data => {
      if (cancelled) return
      if (data.error) { setError(data.error); return }
      setInterp(data.interpretation)
    }).catch(() => !cancelled && setError('Could not generate an interpretation.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [period])

  return (
    <div style={{ ...card, background: 'linear-gradient(135deg, #3B5249 0%, #2C3E37 100%)', color: '#fff' }}>
      <h2 style={{ ...sectionTitle, color: '#C4924A' }}>💡 What this means</h2>
      {loading && <p style={{ font: '400 13px Inter,sans-serif', color: '#E8E3DA', margin: 0 }}>Reading the numbers and writing a plain-English summary…</p>}
      {error && !loading && <p style={{ font: '400 13px Inter,sans-serif', color: '#F2C4C4', margin: 0 }}>{error}</p>}
      {interp && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff' }}>{interp.headline}</div>
          <p style={{ font: '400 14px/1.6 Inter,sans-serif', color: '#E8E3DA', margin: 0 }}>{interp.summary}</p>
          <div style={{ background: 'rgba(196,146,74,0.18)', borderRadius: 8, padding: 12 }}>
            <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#C4924A', marginBottom: 4 }}>So what?</div>
            <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#fff', margin: 0 }}>{interp.soWhat}</p>
          </div>
          {interp.actions?.length > 0 && (
            <div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#C4924A', marginBottom: 6 }}>Do this next</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {interp.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, font: '400 13px/1.5 Inter,sans-serif', color: '#fff' }}>
                    <span style={{ color: '#C4924A', fontWeight: 700 }}>{i + 1}.</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

  const trendData = (summary?.trend ?? []).map(t => ({ date: t.date.slice(4, 6) + '/' + t.date.slice(6, 8), users: t.users }))
  const deviceData = (summary?.devices ?? []).map(d => ({ name: DEVICE_LABELS[d.device] ?? d.device, value: d.sessions }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={btnGhost(period === p.value)}>{p.label}</button>
          ))}
        </div>
        {summary && (
          <a href={`/api/admin/analytics/export?period=${period}`} style={btnPrimary}>⬇ Download PDF Report</a>
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
          <InterpretationCard period={period} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard icon="👀" label="Visitors" value={summary.totals.activeUsers} changePct={summary.totals.activeUsersChangePct} accent="#3B5249" />
            <KpiCard icon="🔁" label="Visits" value={summary.totals.sessions} changePct={summary.totals.sessionsChangePct} accent="#6E8B7F" />
            <KpiCard icon="🆕" label="New Visitors" value={summary.totals.newUsers} accent="#C4924A" />
            <KpiCard icon="🎯" label="Booking Conversion" value={`${summary.conversionRatePct}%`} accent="#8C6D4F" />
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>📈 Visitors Over Time</h2>
            {trendData.length === 0 ? (
              <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No data for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B5249" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3B5249" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="users" name="Visitors" stroke="#3B5249" strokeWidth={2} fill="url(#visitorsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <BarListCard title="Where visitors came from" icon="🧭" rows={summary.channels} labelKey="channel" valueKey="sessions" labelMap={CHANNEL_LABELS} />
            <BarListCard title="Most-viewed pages" icon="📄" rows={summary.pages} labelKey="path" valueKey="views" formatLabel={shortPath} />
            <BarListCard title="What visitors did" icon="⚡" rows={summary.actions.filter(a => a.count > 0)} labelKey="name" valueKey="count" labelMap={ACTION_LABELS} />

            <div style={card}>
              <h2 style={sectionTitle}>📱 Device</h2>
              {deviceData.length === 0 ? (
                <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {deviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<TooltipBox />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <BarListCard title="Top visitor locations" icon="🌍" rows={summary.countries} labelKey="country" valueKey="users" />
          </div>
        </>
      )}
    </div>
  )
}
