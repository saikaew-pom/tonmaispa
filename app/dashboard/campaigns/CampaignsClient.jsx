'use client'

import { useState, useEffect, useRef } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import {
  OBJECTIVE_PRESETS, PACKAGE_OPTIONS, HOLIDAY_OPTIONS, AUDIENCE_CHIPS,
  BUDGET_TIERS, PERIOD_PRESETS, CHANNEL_OPTIONS,
} from '@/lib/campaign-presets'

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = (active) => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (active ? '#3B5249' : 'var(--color-border)'), background: active ? '#3B5249' : '#fff', color: active ? '#fff' : '#1C1917', font: '500 13px Inter,sans-serif', cursor: 'pointer' })
const chip = (active) => ({ padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (active ? '#C4924A' : 'var(--color-border)'), background: active ? '#FBF1E2' : '#fff', color: active ? '#8C6D4F' : '#4A4745', font: '500 12px Inter,sans-serif', cursor: 'pointer' })
const CHART_COLORS = ['#3B5249', '#C4924A', '#6E8B7F', '#D9B98A', '#8C6D4F', '#A8BDB4', '#E8D5B7']
const money = (n) => `฿${Math.round(n ?? 0).toLocaleString()}`

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const copy = new Date(d); copy.setDate(copy.getDate() + n); return copy }

function computePeriod(presetId, holidayId, customStart, customEnd) {
  const today = new Date()
  const preset = PERIOD_PRESETS.find(p => p.id === presetId)
  if (!preset) return { start: toYMD(today), end: toYMD(addDays(today, 30)) }
  if (preset.days) return { start: toYMD(today), end: toYMD(addDays(today, preset.days)) }
  if (preset.custom) return { start: customStart || toYMD(today), end: customEnd || toYMD(addDays(today, 14)) }
  if (preset.usesHolidayPicker) {
    const h = HOLIDAY_OPTIONS.find(h => h.id === holidayId) ?? HOLIDAY_OPTIONS[0]
    if (!h.startMonth) return { start: customStart || toYMD(today), end: customEnd || toYMD(addDays(today, 7)) }
    const year = today.getFullYear()
    return { start: `${year}-${pad(h.startMonth)}-${pad(h.startDay)}`, end: `${year}-${pad(h.endMonth)}-${pad(h.endDay)}` }
  }
  if (preset.explicit) {
    const year = today.getFullYear()
    return { start: `${year}-${pad(preset.explicit.startMonth)}-01`, end: `${year}-${pad(preset.explicit.endMonth)}-28` }
  }
  return { start: toYMD(today), end: toYMD(addDays(today, 30)) }
}

const LOADING_STEPS = ['Drafting your campaign…', 'Fact-checking against your real data…', 'Finalizing…']

export default function CampaignsClient({ context, campaigns: initCampaigns, prefillObjective }) {
  const [campaigns, setCampaigns] = useState(initCampaigns)
  const [view, setView] = useState('builder') // 'builder' | 'plan'
  const [selectedId, setSelectedId] = useState(null)

  // Builder state
  const [objPreset, setObjPreset] = useState(null)
  const [objectiveText, setObjectiveText] = useState(prefillObjective || '')
  const [packagePick, setPackagePick] = useState(PACKAGE_OPTIONS[0])
  const [holidayPick, setHolidayPick] = useState(HOLIDAY_OPTIONS[0].id)
  const [freeTextExtra, setFreeTextExtra] = useState('')
  const [audience, setAudience] = useState([])
  const [budgetTier, setBudgetTier] = useState(null)
  const [customBudget, setCustomBudget] = useState('')
  const [periodPreset, setPeriodPreset] = useState('next_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [channels, setChannels] = useState([])
  const [constraints, setConstraints] = useState('')
  const [quickBrief, setQuickBrief] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)
  const [draftPlan, setDraftPlan] = useState(null)
  const [critique, setCritique] = useState(null)
  const [showFactCheck, setShowFactCheck] = useState(false)
  const stepTimer = useRef(null)

  useEffect(() => {
    if (loading) {
      setLoadingStep(0)
      // Real timing against MiniMax-M3: draft ~60-90s, critique ~15-30s, distill ~60-90s.
      stepTimer.current = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 70000)
    } else if (stepTimer.current) {
      clearInterval(stepTimer.current)
    }
    return () => stepTimer.current && clearInterval(stepTimer.current)
  }, [loading])

  const applyObjectivePreset = (p) => {
    setObjPreset(p.id)
    if (p.id === 'write_own') { setObjectiveText(''); return }
    if (p.picker === 'package') { setObjectiveText(p.sentence.replace('{package}', packagePick)); return }
    if (p.picker === 'freeText') { setObjectiveText(p.sentence.replace('{treatment}', freeTextExtra || '…')); return }
    if (p.picker === 'holiday') {
      const h = HOLIDAY_OPTIONS.find(h => h.id === holidayPick)
      setObjectiveText(p.sentence.replace('{holiday}', h.label))
      setPeriodPreset('holiday')
      return
    }
    setObjectiveText(p.sentence)
  }

  const toggleChip = (list, setList, value) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const period = computePeriod(periodPreset, holidayPick, customStart, customEnd)
  const budgetAmount = budgetTier === 'custom' ? Number(customBudget) || 0 : BUDGET_TIERS.find(t => t.id === budgetTier)?.amount ?? null

  const briefSummary = quickBrief.trim()
    ? quickBrief.trim().slice(0, 80) + (quickBrief.length > 80 ? '…' : '')
    : [objectiveText || 'No objective yet', audience.length ? audience.join(', ') : null, budgetAmount != null ? money(budgetAmount) : null, `${period.start} – ${period.end}`, channels.length ? channels.join('/') : null]
        .filter(Boolean).join(' · ')

  const canGenerate = quickBrief.trim() || objectiveText.trim()

  const generate = async () => {
    setLoading(true)
    setError('')
    setPlan(null)
    try {
      const body = quickBrief.trim()
        ? { freeText: quickBrief.trim(), periodStart: period.start, periodEnd: period.end }
        : {
            objective: objectiveText,
            audience: audience.join(', '),
            budgetTHB: budgetAmount,
            periodStart: period.start,
            periodEnd: period.end,
            channels,
            constraints,
          }
      const res = await fetch('/api/admin/campaigns/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate campaign plan')
      setPlan(data.plan)
      setDraftPlan(null)
      setCritique(null)
      setView('plan')
      if (data.id) {
        setSelectedId(data.id)
        setCampaigns(c => [{ id: data.id, name: data.plan?.interpretedBrief?.objective || objectiveText || 'Untitled campaign', status: 'draft', period_start: period.start, period_end: period.end, created_at: new Date().toISOString() }, ...c])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCampaign = async (id) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campaigns?id=${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load campaign')
      setPlan(data.campaign.plan)
      setDraftPlan(data.campaign.draft_plan)
      setCritique(data.campaign.critique)
      setSelectedId(id)
      setView('plan')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id, status) => {
    await fetch(`/api/admin/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setCampaigns(c => c.map(camp => camp.id === id ? { ...camp, status } : camp))
  }

  const budgetDonutData = (plan?.channelPlan ?? []).map(c => ({ name: c.channel, value: c.budgetTHB }))

  const STATUS_COLORS = { draft: '#9B9390', active: '#3B5249', completed: '#C4924A', archived: '#C0392B' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {view === 'builder' && (
          <>
            <div style={card}>
              <h2 style={sectionTitle}>Quick brief (optional)</h2>
              <textarea
                className="input"
                placeholder="Or just describe your campaign in your own words — Thai or English is fine…"
                value={quickBrief}
                onChange={e => setQuickBrief(e.target.value)}
                rows={3}
                style={{ width: '100%', resize: 'vertical', font: '400 13px Inter,sans-serif' }}
              />
            </div>

            <div style={{ ...card, opacity: quickBrief.trim() ? 0.4 : 1, pointerEvents: quickBrief.trim() ? 'none' : 'auto' }}>
              <h2 style={sectionTitle}>1. What do you want to achieve?</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {OBJECTIVE_PRESETS.map(p => (
                  <button key={p.id} onClick={() => applyObjectivePreset(p)} style={btnGhost(objPreset === p.id)}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>

              {objPreset === 'promote_package' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PACKAGE_OPTIONS.map(pkg => (
                    <button key={pkg} onClick={() => { setPackagePick(pkg); setObjectiveText(`Sell more of the ${pkg}`) }} style={chip(packagePick === pkg)}>{pkg}</button>
                  ))}
                  <span style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', alignSelf: 'center' }}>
                    {context.hints.packageBookings60d[packagePick] ?? 0} booked in the last 60 days
                  </span>
                </div>
              )}

              {objPreset === 'holiday_push' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {HOLIDAY_OPTIONS.map(h => (
                    <button key={h.id} onClick={() => { setHolidayPick(h.id); setObjectiveText(`Run a seasonal promotion around ${h.label}`); setPeriodPreset('holiday') }} style={chip(holidayPick === h.id)}>{h.label}</button>
                  ))}
                </div>
              )}

              {objPreset === 'new_treatment' && (
                <input className="input" placeholder="Name of the new treatment" value={freeTextExtra}
                  onChange={e => { setFreeTextExtra(e.target.value); setObjectiveText(`Introduce and build awareness for a new treatment: ${e.target.value}`) }}
                  style={{ marginTop: 10, maxWidth: 320 }} />
              )}

              {objPreset === 'fill_weekdays' && (
                <p style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 8 }}>
                  Weekday avg revenue ~{money(context.hints.weekdayVsWeekendGap.weekdayAvgRevenue)}/day vs weekend ~{money(context.hints.weekdayVsWeekendGap.weekendAvgRevenue)}/day
                </p>
              )}
              {objPreset === 'boost_low_season' && (
                <p style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 8 }}>
                  Current month ({context.hints.lowVsPeakMonth.currentMonth}): {money(context.hints.lowVsPeakMonth.currentMonthRevenue)} vs peak month ({context.hints.lowVsPeakMonth.peakMonth}): {money(context.hints.lowVsPeakMonth.peakMonthRevenue)}
                </p>
              )}

              <textarea className="input" value={objectiveText} onChange={e => setObjectiveText(e.target.value)}
                placeholder="Describe what you want in your own words — Thai or English is fine"
                rows={2} style={{ width: '100%', marginTop: 12, resize: 'vertical', font: '400 13px Inter,sans-serif' }} />
            </div>

            <div style={{ ...card, opacity: quickBrief.trim() ? 0.4 : 1, pointerEvents: quickBrief.trim() ? 'none' : 'auto' }}>
              <h2 style={sectionTitle}>2. Who is it for?</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AUDIENCE_CHIPS.map(a => (
                  <button key={a} onClick={() => toggleChip(audience, setAudience, a)} style={chip(audience.includes(a))}>{a}</button>
                ))}
              </div>
            </div>

            <div style={{ ...card, opacity: quickBrief.trim() ? 0.4 : 1, pointerEvents: quickBrief.trim() ? 'none' : 'auto' }}>
              <h2 style={sectionTitle}>3. Budget</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {BUDGET_TIERS.map(t => (
                  <button key={t.id} onClick={() => setBudgetTier(t.id)} style={btnGhost(budgetTier === t.id)}>
                    {t.label}{t.amount != null ? ` (~${money(t.amount)})` : ''}
                  </button>
                ))}
              </div>
              {budgetTier && <p style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 8 }}>{BUDGET_TIERS.find(t => t.id === budgetTier)?.note}</p>}
              {budgetTier === 'custom' && (
                <input className="input" type="number" placeholder="Amount in THB" value={customBudget} onChange={e => setCustomBudget(e.target.value)} style={{ marginTop: 8, maxWidth: 160 }} />
              )}
            </div>

            <div style={{ ...card, opacity: quickBrief.trim() ? 0.4 : 1, pointerEvents: quickBrief.trim() ? 'none' : 'auto' }}>
              <h2 style={sectionTitle}>4. When?</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PERIOD_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPeriodPreset(p.id)} style={btnGhost(periodPreset === p.id)}>{p.label}</button>
                ))}
              </div>
              {periodPreset === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input className="input" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ maxWidth: 150 }} />
                  <span>–</span>
                  <input className="input" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ maxWidth: 150 }} />
                </div>
              )}
              <p style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 8 }}>{period.start} → {period.end}</p>
            </div>

            <details style={{ ...card, opacity: quickBrief.trim() ? 0.4 : 1, pointerEvents: quickBrief.trim() ? 'none' : 'auto' }}>
              <summary style={{ ...sectionTitle, cursor: 'pointer', display: 'inline-block' }}>5. Channels & constraints (optional)</summary>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {CHANNEL_OPTIONS.map(c => (
                  <button key={c} onClick={() => toggleChip(channels, setChannels, c)} style={chip(channels.includes(c))}>{c}</button>
                ))}
              </div>
              <input className="input" placeholder="e.g. no discounts deeper than 15%" value={constraints} onChange={e => setConstraints(e.target.value)} style={{ width: '100%', marginTop: 10 }} />
            </details>

            {/* Sticky review bar */}
            <div style={{ ...card, position: 'sticky', bottom: 12, background: '#1C1917', color: '#FAF6F0' }}>
              <div style={{ font: '400 12px Inter,sans-serif', color: 'rgba(250,246,240,0.7)', marginBottom: 8 }}>{briefSummary}</div>
              <button onClick={generate} disabled={loading || !canGenerate} style={{ ...btnPrimary, opacity: loading || !canGenerate ? 0.6 : 1, cursor: loading || !canGenerate ? 'not-allowed' : 'pointer' }}>
                {loading ? LOADING_STEPS[loadingStep] : '✨ Generate Campaign Plan'}
              </button>
              {error && <p style={{ color: '#F87171', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
            </div>
          </>
        )}

        {view === 'plan' && plan && (
          <>
            <button onClick={() => setView('builder')} style={{ ...btnGhost(false), alignSelf: 'flex-start', width: 'fit-content' }}>← New campaign</button>

            {plan.interpretedBrief && (
              <div style={{ ...card, background: '#F0F4F2' }}>
                <h2 style={sectionTitle}>How the AI understood your brief</h2>
                <p style={{ font: '400 13px Inter,sans-serif', color: '#4A4745', margin: 0 }}>
                  <strong>Objective:</strong> {plan.interpretedBrief.objective} · <strong>Audience:</strong> {plan.interpretedBrief.audience} · <strong>Budget:</strong> {plan.interpretedBrief.budgetTHB ? money(plan.interpretedBrief.budgetTHB) : '—'} · <strong>Period:</strong> {plan.interpretedBrief.period}
                </p>
              </div>
            )}

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={sectionTitle}>Big Idea</h2>
                  <h3 style={{ font: '400 24px Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>{plan.bigIdea?.title}</h3>
                  <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663', marginTop: 8 }}>{plan.bigIdea?.rationale}</p>
                </div>
                {selectedId && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/api/admin/campaigns/${selectedId}/export?format=pdf`} style={btnGhost(false)}>⬇ PDF</a>
                    <a href={`/api/admin/campaigns/${selectedId}/export?format=docx`} style={btnGhost(false)}>⬇ Word (.docx)</a>
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

            {plan.campaignIdeas?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Alternate Ideas</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.campaignIdeas.map((c, i) => (
                    <div key={i} style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 12 }}>
                      <div style={{ font: '600 13px Inter,sans-serif' }}>{c.name} — &ldquo;{c.tagline}&rdquo;</div>
                      <div style={{ font: '400 12px Inter,sans-serif', color: '#6B6663', marginTop: 4 }}>{c.theme}</div>
                      <div style={{ font: '500 11px Inter,sans-serif', color: '#C4924A', marginTop: 4 }}>{c.whyItFits}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.channelPlan?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={card}>
                  <h2 style={sectionTitle}>Budget Split</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={budgetDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                        {budgetDonutData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={money} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={card}>
                  <h2 style={sectionTitle}>Channel Plan</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.channelPlan.map((c, i) => (
                      <div key={i} style={{ fontSize: 12 }}>
                        <strong>{c.channel}</strong> — {money(c.budgetTHB)} — {c.role}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {plan.timeline?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Timeline</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.timeline.map((t, i) => (
                    <div key={i} style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 12 }}>
                      <div style={{ font: '600 13px Inter,sans-serif' }}>{t.phase} (Day {t.startOffset}–{t.startOffset + t.durationDays})</div>
                      <div style={{ font: '400 12px Inter,sans-serif', color: '#6B6663', marginTop: 4 }}>{(t.activities ?? []).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.messagingPillars?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Messaging Pillars</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.messagingPillars.map((m, i) => (
                    <div key={i}>
                      <strong style={{ fontSize: 13 }}>{m.pillar}</strong>
                      <p style={{ font: '400 12px/1.5 Inter,sans-serif', color: '#6B6663', margin: '4px 0' }}>{m.description}</p>
                      <p style={{ font: '500 11px Inter,sans-serif', color: '#C4924A', margin: 0 }}>{m.proofPoint}</p>
                    </div>
                  ))}
                </div>
                {plan.taglines?.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plan.taglines.map((t, i) => <span key={i} style={chip(false)}>{t}</span>)}
                  </div>
                )}
              </div>
            )}

            {plan.audiencePersonas?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plan.audiencePersonas.length, 2)}, 1fr)`, gap: 20 }}>
                {plan.audiencePersonas.map((a, i) => (
                  <div key={i} style={card}>
                    <h2 style={sectionTitle}>Persona: {a.name}</h2>
                    <p style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663' }}>{a.profile}</p>
                    <p style={{ font: '400 12px Inter,sans-serif', color: '#4A4745' }}><strong>Motivation:</strong> {a.motivation}</p>
                    <p style={{ font: '400 12px Inter,sans-serif', color: '#4A4745' }}><strong>Best channel:</strong> {a.bestChannel}</p>
                  </div>
                ))}
              </div>
            )}

            {plan.contentCalendar?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Content Calendar</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ textAlign: 'left', color: '#9B9390' }}><th>Week</th><th>Channel</th><th>Type</th><th>Description</th></tr></thead>
                  <tbody>
                    {plan.contentCalendar.map((c, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #F0ECE6' }}>
                        <td style={{ padding: '6px 0' }}>{c.week}</td><td>{c.channel}</td><td>{c.contentType}</td><td>{c.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plan.journeyMap?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Customer Journey Map</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.journeyMap.map((j, i) => (
                    <div key={i}>
                      <strong style={{ fontSize: 13 }}>{j.stage} — {j.touchpoint}</strong>
                      <p style={{ font: '400 12px/1.5 Inter,sans-serif', color: '#6B6663', margin: '4px 0' }}>{j.content}</p>
                      <p style={{ font: '500 11px Inter,sans-serif', color: '#C0392B', margin: 0 }}>Leakage risk: {j.leakageRisk}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.kpis?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>KPIs</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ textAlign: 'left', color: '#9B9390' }}><th>Metric</th><th>Target</th><th>How to measure</th></tr></thead>
                  <tbody>
                    {plan.kpis.map((k, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #F0ECE6' }}>
                        <td style={{ padding: '6px 0' }}>{k.metric}</td><td>{k.target}</td><td>{k.howToMeasure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plan.preMortem?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>Pre-Mortem — What Could Go Wrong</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.preMortem.map((r, i) => (
                    <div key={i} style={{ fontSize: 12 }}>
                      <strong>{r.risk}</strong> ({r.likelihood}) — {r.mitigation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Campaign list sidebar */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ ...sectionTitle, margin: 0 }}>Campaigns</h2>
          <button onClick={() => { setView('builder'); setPlan(null); setSelectedId(null) }} style={{ ...btnGhost(false), padding: '4px 10px' }}>+ New</button>
        </div>
        {campaigns.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No campaigns yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map(c => (
            <div key={c.id} style={{ border: '1px solid ' + (selectedId === c.id ? '#3B5249' : '#F0ECE6'), borderRadius: 8, padding: 10, background: selectedId === c.id ? '#F0F4F2' : '#fff' }}>
              <button onClick={() => loadCampaign(c.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917' }}>{c.name}</div>
                <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390' }}>{c.period_start} → {c.period_end}</div>
              </button>
              <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                style={{ marginTop: 6, fontSize: 11, border: 'none', background: STATUS_COLORS[c.status] + '22', color: STATUS_COLORS[c.status], borderRadius: 4, padding: '2px 6px' }}>
                {['draft', 'active', 'completed', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
