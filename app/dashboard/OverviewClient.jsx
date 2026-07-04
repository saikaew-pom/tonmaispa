'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnGhost = (active) => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'), background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 13px Inter,sans-serif', cursor: 'pointer', transition: 'all .15s' })
const STATUS_COLORS = { pending: '#C4924A', confirmed: '#3B5249', completed: '#6B6663', cancelled: '#C0392B' }
const CHART_COLORS = ['#3B5249', '#C4924A', '#6E8B7F', '#D9B98A', '#8C6D4F', '#A8BDB4', '#E8D5B7']

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return toYMD(d) }
const money = (n) => `฿${Math.round(n ?? 0).toLocaleString()}`
const shortDate = (s) => { const d = new Date(s + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }

const PERIOD_PRESETS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: 'custom', label: 'Custom', days: null },
]

const TooltipBox = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1C1917', color: '#FAF6F0', padding: '8px 12px', borderRadius: 6, font: '500 12px Inter,sans-serif' }}>
      <div style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i}>{p.name}: {fmt ? fmt(p.value) : p.value}</div>)}
    </div>
  )
}

const KpiCard = ({ label, value, sub, accent, href }) => {
  const content = (
    <div style={{ ...card, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{label}</div>
      <div style={{ font: '400 28px Cormorant Garamond,serif', color: accent ?? '#1C1917', marginTop: 4 }}>{value}</div>
      <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{sub}</div>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none', flex: 1, minWidth: 150, display: 'flex' }}>{content}</Link> : content
}

const StatusBadge = ({ status }) => (
  <span style={{
    background: (STATUS_COLORS[status] ?? '#6B6663') + '1A', color: STATUS_COLORS[status] ?? '#6B6663',
    padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'capitalize',
  }}>
    {status}
  </span>
)

export default function OverviewClient({
  defaultRange, revenue: initRevenue, therapistUtilization: initUtil, forwardBookings,
  newEnquiriesCount, recentEnquiries, upcoming, statusCounts: initStatusCounts,
}) {
  const [preset, setPreset] = useState('7d')
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [revenue, setRevenue] = useState(initRevenue)
  const [therapistUtilization, setTherapistUtilization] = useState(initUtil)
  const [statusCounts, setStatusCounts] = useState(initStatusCounts)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const applyPreset = async (p) => {
    setPreset(p.id)
    if (p.id === 'custom') return
    const newStart = daysAgo(p.days)
    const newEnd = toYMD(new Date())
    setStartDate(newStart)
    setEndDate(newEnd)
    await fetchOverview(newStart, newEnd)
  }

  const applyCustomDate = async (key, value) => {
    const newStart = key === 'start' ? value : startDate
    const newEnd = key === 'end' ? value : endDate
    if (key === 'start') setStartDate(value)
    else setEndDate(value)
    setPreset('custom')
    await fetchOverview(newStart, newEnd)
  }

  const fetchOverview = async (s, e) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/overview?startDate=${s}&endDate=${e}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load overview')
      setRevenue(data.revenue)
      setTherapistUtilization(data.therapistUtilization)
      setStatusCounts(data.statusCounts)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setLoading(false)
    }
  }

  const avgOccupancy = therapistUtilization.length
    ? Math.round(therapistUtilization.reduce((s, t) => s + t.occupancyPct, 0) / therapistUtilization.length)
    : 0

  const dailyTrendData = useMemo(() => {
    return Object.entries(revenue.dailyTrend ?? {}).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rev]) => ({ date: shortDate(date), revenue: rev }))
  }, [revenue])

  const categoryData = useMemo(() => {
    return Object.entries(revenue.byCategory ?? {}).map(([name, v]) => ({ name: name.replace('_', ' '), value: v.revenue }))
      .sort((a, b) => b.value - a.value)
  }, [revenue])

  const statusData = useMemo(() => {
    return Object.entries(statusCounts ?? {}).map(([status, count]) => ({ status, count }))
  }, [statusCounts])

  const next7DaysForecast = useMemo(() => {
    return (forwardBookings?.weeks ?? []).filter(w => w.weekOffset === 0)
      .reduce((s, w) => s + w.forecastRevenue, 0)
  }, [forwardBookings])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Period filter */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERIOD_PRESETS.filter(p => p.id !== 'custom').map(p => (
              <button key={p.id} onClick={() => applyPreset(p)} style={btnGhost(preset === p.id)}>{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" type="date" value={startDate} onChange={e => applyCustomDate('start', e.target.value)} style={{ maxWidth: 150 }} />
            <span style={{ color: '#9B9390' }}>–</span>
            <input className="input" type="date" value={endDate} onChange={e => applyCustomDate('end', e.target.value)} style={{ maxWidth: 150 }} />
          </div>
        </div>
        {loading && <p style={{ color: '#9B9390', font: '400 12px Inter,sans-serif', marginTop: 10 }}>Loading…</p>}
        {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Revenue" value={money(revenue.totalRevenue)} sub={`${revenue.bookingCount} completed bookings`} accent="#3B5249" href="/dashboard/insights" />
        <KpiCard label="Avg Booking Value" value={money(revenue.avgBookingValue)} sub={`${revenue.cancellationRate}% cancellation rate`} />
        <KpiCard label="Therapist Occupancy" value={`${avgOccupancy}%`} sub={`avg across ${therapistUtilization.length} therapists`} accent="#6E8B7F" href="/dashboard/therapists" />
        <KpiCard label="New Enquiries" value={newEnquiriesCount} sub="awaiting response" accent={newEnquiriesCount > 0 ? '#C0392B' : undefined} href="/dashboard/enquiries" />
        <KpiCard label="Next 7 Days" value={money(next7DaysForecast)} sub="forecast revenue on the books" accent="#C4924A" href="/dashboard/bookings" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 20 }}>
        <div style={card}>
          <h2 style={sectionTitle}>Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<TooltipBox fmt={money} />} cursor={{ fill: '#F2EDE5' }} />
              <Bar dataKey="revenue" fill="#3B5249" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>By Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<TooltipBox fmt={money} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>Booking Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#4A4745' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip cursor={{ fill: '#F2EDE5' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {statusData.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#6B6663'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming + Recent enquiries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        <div style={card}>
          <h2 style={sectionTitle}>Upcoming Bookings</h2>
          {upcoming.length === 0 ? (
            <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No upcoming bookings.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {upcoming.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F0ECE6' }}>
                    <td style={{ padding: '10px 4px', font: '600 13px Inter,sans-serif' }}>{b.guest_name}</td>
                    <td style={{ padding: '10px 4px', font: '400 12px Inter,sans-serif', color: '#6B6663' }}>{b.spa_treatments?.name ?? '—'}</td>
                    <td style={{ padding: '10px 4px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{b.date} · {b.time_slot?.slice(0, 5)}</td>
                    <td style={{ padding: '10px 4px' }}><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/dashboard/bookings" style={{ display: 'inline-block', marginTop: 12, font: '600 11px Inter,sans-serif', color: '#3B5249' }}>View all bookings →</Link>
        </div>

        <div style={card}>
          <h2 style={sectionTitle}>Recent Enquiries</h2>
          {recentEnquiries.length === 0 ? (
            <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No enquiries yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentEnquiries.map(e => (
                <div key={e.id} style={{ border: '1px solid #F0ECE6', borderRadius: 6, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: '600 12px Inter,sans-serif' }}>{e.name}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{e.phone} · {new Date(e.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/enquiries" style={{ display: 'inline-block', marginTop: 12, font: '600 11px Inter,sans-serif', color: '#3B5249' }}>View all enquiries →</Link>
        </div>
      </div>
    </div>
  )
}
