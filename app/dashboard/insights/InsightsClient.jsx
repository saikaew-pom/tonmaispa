'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = (active) => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'), background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 13px Inter,sans-serif', cursor: 'pointer', transition: 'all .15s' })
const PRIORITY_COLORS = { high: '#C0392B', medium: '#C4924A', low: '#6B6663' }
const CHART_COLORS = ['#3B5249', '#C4924A', '#6E8B7F', '#D9B98A', '#8C6D4F', '#A8BDB4', '#E8D5B7', '#5C7A6E']

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toYMD(d) }
const money = (n) => `฿${Math.round(n ?? 0).toLocaleString()}`
const shortDate = (s) => { const d = new Date(s + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }

const LOADING_STEPS = ['Drafting recommendations…', 'Fact-checking against your real data…', 'Finalizing…']

const TooltipBox = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1C1917', color: '#FAF6F0', padding: '8px 12px', borderRadius: 6, font: '500 12px Inter,sans-serif' }}>
      <div style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i}>{p.name}: {fmt ? fmt(p.value) : p.value}</div>)}
    </div>
  )
}

export default function InsightsClient({ defaultRange, revenue: initRevenue, therapistUtilization: initUtil, forwardBookings: initForward, history: initHistory }) {
  const [mode, setMode] = useState('past') // 'past' | 'forward'
  const [pastPreset, setPastPreset] = useState(30)
  const [forwardDays, setForwardDays] = useState(30)
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [revenue, setRevenue] = useState(initRevenue)
  const [therapistUtilization, setTherapistUtilization] = useState(initUtil)
  const [forwardBookings, setForwardBookings] = useState(initForward)
  const [recommendations, setRecommendations] = useState(null)
  const [critique, setCritique] = useState(null)
  const [showFactCheck, setShowFactCheck] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(initHistory)
  const [viewingId, setViewingId] = useState(null)
  const stepTimer = useRef(null)

  useEffect(() => {
    if (loading) {
      setLoadingStep(0)
      // Real timing against MiniMax-M3: draft ~30-90s, critique ~15-30s, distill ~30-90s.
      stepTimer.current = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 60000)
    } else if (stepTimer.current) {
      clearInterval(stepTimer.current)
    }
    return () => stepTimer.current && clearInterval(stepTimer.current)
  }, [loading])

  const applyPastPreset = (days) => {
    setMode('past')
    setPastPreset(days)
    setStartDate(daysAgo(days))
    setEndDate(toYMD(new Date()))
  }

  const applyForwardPreset = (days) => {
    setMode('forward')
    setForwardDays(days)
  }

  const avgOccupancy = therapistUtilization.length
    ? Math.round(therapistUtilization.reduce((s, t) => s + t.occupancyPct, 0) / therapistUtilization.length)
    : 0

  const forwardWeeksInWindow = useMemo(() => {
    const maxWeek = Math.ceil(forwardDays / 7)
    return (forwardBookings?.weeks ?? []).filter(w => w.weekOffset >= 0 && w.weekOffset < maxWeek)
  }, [forwardBookings, forwardDays])

  const forwardTotals = useMemo(() => ({
    revenue: forwardWeeksInWindow.reduce((s, w) => s + w.forecastRevenue, 0),
    bookings: forwardWeeksInWindow.reduce((s, w) => s + w.bookingCount, 0),
    avgOccupancy: forwardWeeksInWindow.length ? Math.round(forwardWeeksInWindow.reduce((s, w) => s + w.occupancyPct, 0) / forwardWeeksInWindow.length) : 0,
  }), [forwardWeeksInWindow])

  const dailyTrendData = useMemo(() => {
    return Object.entries(revenue.dailyTrend ?? {}).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rev]) => ({ date: shortDate(date), revenue: rev }))
  }, [revenue])

  const categoryData = useMemo(() => {
    return Object.entries(revenue.byCategory ?? {}).map(([name, v]) => ({ name: name.replace('_', ' '), value: v.revenue }))
      .sort((a, b) => b.value - a.value)
  }, [revenue])

  const sourceData = useMemo(() => {
    return Object.entries(revenue.bySource ?? {}).map(([name, v]) => ({ name, revenue: v.revenue, count: v.count }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [revenue])

  const forwardChartData = useMemo(() => {
    return forwardWeeksInWindow.map(w => ({ week: `Wk ${w.weekOffset + 1}`, revenue: w.forecastRevenue, occupancy: w.occupancyPct }))
  }, [forwardWeeksInWindow])

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
      setForwardBookings(data.summary.forwardBookings)
      setRecommendations(data.recommendations)
      setCritique(data.critique)
      setCurrentId(data.id)
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
      if (data.insight.input_summary.forwardBookings) setForwardBookings(data.insight.input_summary.forwardBookings)
      setRecommendations(data.insight.recommendations)
      setCritique(data.insight.critique)
      setCurrentId(id)
      setStartDate(data.insight.period_start)
      setEndDate(data.insight.period_end)
      setMode('past')
      setPastPreset(null)
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
          <div key={i} style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>{ins.title}</div>
              <span style={{ flexShrink: 0, font: '600 9px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: PRIORITY_COLORS[ins.priority] ?? '#6B6663' }}>{ins.priority}</span>
            </div>
            <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663', margin: '8px 0 0' }}>{ins.detail}</p>
            {ins.suggestedAction && (
              <p style={{ font: '600 12px/1.5 Inter,sans-serif', color: '#3B5249', margin: '8px 0 0' }}>→ {ins.suggestedAction}</p>
            )}
            <a href={`/dashboard/campaigns?objective=${encodeURIComponent(ins.title)}`}
              style={{ display: 'inline-block', marginTop: 10, font: '600 11px Inter,sans-serif', color: '#C4924A', textDecoration: 'none' }}>
              ✨ Plan a campaign from this insight →
            </a>
          </div>
        ))}
      </div>
    </div>
  )

  const KpiCard = ({ label, value, sub, accent }) => (
    <div style={{ ...card, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390' }}>{label}</div>
      <div style={{ font: '400 28px Cormorant Garamond,serif', color: accent ?? '#1C1917', marginTop: 4 }}>{value}</div>
      <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Mode + range controls */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 6, background: '#F2EDE5', padding: 4, borderRadius: 10 }}>
              <button onClick={() => setMode('past')} style={{ ...btnGhost(mode === 'past'), border: 'none', background: mode === 'past' ? '#3B5249' : 'transparent' }}>📊 Historical</button>
              <button onClick={() => setMode('forward')} style={{ ...btnGhost(mode === 'forward'), border: 'none', background: mode === 'forward' ? '#3B5249' : 'transparent' }}>📅 Forward Pipeline</button>
            </div>
          </div>

          {mode === 'past' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[30, 60, 90].map(d => (
                  <button key={d} onClick={() => applyPastPreset(d)} style={btnGhost(pastPreset === d)}>Last {d} days</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" type="date" value={startDate} onChange={e => { setPastPreset(null); setStartDate(e.target.value) }} style={{ maxWidth: 150 }} />
                <span style={{ color: '#9B9390' }}>–</span>
                <input className="input" type="date" value={endDate} onChange={e => { setPastPreset(null); setEndDate(e.target.value) }} style={{ maxWidth: 150 }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => applyForwardPreset(d)} style={btnGhost(forwardDays === d)}>Next {d} days</button>
              ))}
              <span style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', alignSelf: 'center', marginLeft: 4 }}>
                Everything already on the books, starting today
              </span>
            </div>
          )}

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            {mode === 'past' ? (
              <>
                <KpiCard label="Revenue" value={money(revenue.totalRevenue)} sub={`${revenue.bookingCount} completed bookings`} />
                <KpiCard label="Therapist Occupancy" value={`${avgOccupancy}%`} sub={`avg across ${therapistUtilization.length} therapists`} accent="#3B5249" />
                <KpiCard label="Avg Booking Value" value={money(revenue.avgBookingValue)} sub={`${revenue.cancellationRate}% cancellation rate`} />
              </>
            ) : (
              <>
                <KpiCard label="Forecast Revenue" value={money(forwardTotals.revenue)} sub={`next ${forwardDays} days on the books`} accent="#C4924A" />
                <KpiCard label="Forward Bookings" value={forwardTotals.bookings} sub="pending + confirmed" />
                <KpiCard label="Avg Weekly Occupancy" value={`${forwardTotals.avgOccupancy}%`} sub="of scheduled therapist hours" accent="#3B5249" />
              </>
            )}
          </div>

          <button onClick={askForRecommendations} disabled={loading} style={{ ...btnPrimary, marginTop: 18, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? LOADING_STEPS[loadingStep] : '✨ Ask for Recommendations'}
          </button>
          {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
        </div>

        {/* Charts */}
        {mode === 'past' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
            <div style={card}>
              <h2 style={sectionTitle}>Daily Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
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
              <h2 style={sectionTitle}>Revenue by Category</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<TooltipBox fmt={money} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <h2 style={sectionTitle}>Revenue by Source Channel</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4A4745' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<TooltipBox fmt={money} />} cursor={{ fill: '#F2EDE5' }} />
                  <Bar dataKey="revenue" fill="#C4924A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <h2 style={sectionTitle}>Therapist Occupancy</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={therapistUtilization} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4A4745' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<TooltipBox fmt={v => `${v}%`} />} cursor={{ fill: '#F2EDE5' }} />
                  <Bar dataKey="occupancyPct" fill="#6E8B7F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={card}>
              <h2 style={sectionTitle}>Forecast Revenue by Week</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={forwardChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<TooltipBox fmt={money} />} cursor={{ fill: '#F2EDE5' }} />
                  <Bar dataKey="revenue" fill="#C4924A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={card}>
              <h2 style={sectionTitle}>Booked Occupancy by Week</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={forwardChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9B9390' }} axisLine={false} tickLine={false} width={40} unit="%" domain={[0, 100]} />
                  <Tooltip content={<TooltipBox fmt={v => `${v}%`} />} />
                  <Line type="monotone" dataKey="occupancy" stroke="#3B5249" strokeWidth={2.5} dot={{ r: 3, fill: '#3B5249' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {recommendations && (
          <>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Export</h2>
                {currentId && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/api/admin/insights/${currentId}/export?format=pdf`} style={btnGhost(false)}>⬇ PDF</a>
                    <a href={`/api/admin/insights/${currentId}/export?format=docx`} style={btnGhost(false)}>⬇ Word (.docx)</a>
                  </div>
                )}
              </div>
            </div>

            {critique && (
              <div style={card}>
                <button onClick={() => setShowFactCheck(s => !s)} style={{ ...sectionTitle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showFactCheck ? '▾' : '▸'} Show fact-check ({critique.issues?.length ?? 0} issues found and corrected)
                </button>
                {showFactCheck && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(critique.issues ?? []).map((iss, i) => (
                      <div key={i} style={{ fontSize: 12, padding: 8, borderRadius: 6, background: iss.severity === 'must-fix' ? '#FDECEC' : '#F5F2ED' }}>
                        <strong>{iss.location}:</strong> {iss.problem}
                      </div>
                    ))}
                    {(!critique.issues || critique.issues.length === 0) && <p style={{ font: '400 12px Inter,sans-serif', color: '#9B9390' }}>No issues found — the draft was already well-grounded.</p>}
                  </div>
                )}
              </div>
            )}

            {recommendations.groundingNotes?.length > 0 && (
              <div style={{ ...card, background: '#F0F4F2' }}>
                <h2 style={sectionTitle}>Grounding Notes — what&apos;s real data vs. estimated</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recommendations.groundingNotes.map((g, i) => (
                    <div key={i} style={{ font: '400 12px Inter,sans-serif', color: '#4A4745' }}>
                      <span style={{ font: '600 10px Inter,sans-serif', textTransform: 'uppercase', color: g.source === 'actual data' ? '#3B5249' : '#C4924A', marginRight: 6 }}>{g.source}</span>
                      {g.claim}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
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
