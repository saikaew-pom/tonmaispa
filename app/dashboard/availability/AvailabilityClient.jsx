'use client'

import { useState } from 'react'
import Link from 'next/link'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayStr = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()) }

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 20 }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }
const btnDanger = { background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }

export default function AvailabilityClient({ rules: initRules, blocks: initBlocks, treatments, therapists: initTherapists, engineEnabled }) {
  const [rules, setRules] = useState(initRules.map(r => ({ ...r, first_slot: r.first_slot.slice(0, 5), last_slot: r.last_slot.slice(0, 5), day_of_week: r.day_of_week ?? [0, 1, 2, 3, 4, 5, 6] })))
  const [blocks, setBlocks] = useState(initBlocks)
  const [therapists, setTherapists] = useState(initTherapists)

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Booking engine status */}
      <div style={{ ...card, background: engineEnabled ? '#E8EDE9' : '#FBF3E6', borderColor: engineEnabled ? '#3B5249' : '#D9AE72' }}>
        <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917' }}>
          Booking engine is {engineEnabled ? 'ON' : 'OFF'}
        </div>
        <div style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', marginTop: 4 }}>
          {engineEnabled
            ? 'Guests can book live time slots online. The rules below control which slots are offered.'
            : 'The public site currently shows the simple WhatsApp enquiry form. These rules take effect when you turn the engine on in '}
          {!engineEnabled && <Link href="/dashboard/settings" style={{ color: '#3B5249', textDecoration: 'underline' }}>Settings</Link>}
          {!engineEnabled && '.'}
        </div>
      </div>

      <SlotRules rules={rules} setRules={setRules} treatments={treatments} />
      <BlockedDates blocks={blocks} setBlocks={setBlocks} therapists={therapists} />
      <Therapists therapists={therapists} setTherapists={setTherapists} />
    </div>
  )
}

/* ─────────────────────── SLOT RULES ─────────────────────── */
function SlotRules({ rules, setRules, treatments }) {
  const [savingId, setSavingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newScope, setNewScope] = useState('') // '' = global, else treatment_id
  const [err, setErr] = useState('')

  const usedTreatmentIds = new Set(rules.filter(r => r.treatment_id).map(r => r.treatment_id))
  const hasGlobal = rules.some(r => !r.treatment_id)
  const availableTreatments = treatments.filter(t => !usedTreatmentIds.has(t.id))

  const label = r => r.treatment_id
    ? (treatments.find(t => t.id === r.treatment_id)?.name ?? 'Treatment')
    : 'Global — all treatments'

  const patch = (id, field, value) => setRules(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const toggleDay = (id, d) => setRules(rs => rs.map(r => {
    if (r.id !== id) return r
    const set = new Set(r.day_of_week)
    set.has(d) ? set.delete(d) : set.add(d)
    return { ...r, day_of_week: [...set].sort((a, b) => a - b) }
  }))

  const save = async (r) => {
    setSavingId(r.id); setErr('')
    const res = await fetch(`/api/admin/slot-settings/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_of_week: r.day_of_week, first_slot: r.first_slot, last_slot: r.last_slot,
        slot_interval: r.slot_interval, max_concurrent: r.max_concurrent, is_active: r.is_active,
      }),
    })
    setSavingId(null)
    if (!res.ok) setErr((await res.json()).error || 'Save failed')
  }

  const del = async (id) => {
    if (!confirm('Delete this slot rule?')) return
    const res = await fetch(`/api/admin/slot-settings/${id}`, { method: 'DELETE' })
    if (res.ok) setRules(rs => rs.filter(r => r.id !== id))
  }

  const create = async () => {
    setErr('')
    const res = await fetch('/api/admin/slot-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treatment_id: newScope || null, day_of_week: [0, 1, 2, 3, 4, 5, 6], first_slot: '09:00', last_slot: '22:00', slot_interval: 30, max_concurrent: 3, is_active: true }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Could not create'); return }
    setRules(rs => [...rs, { ...data.rule, first_slot: data.rule.first_slot.slice(0, 5), last_slot: data.rule.last_slot.slice(0, 5) }])
    setAdding(false); setNewScope('')
  }

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Slot Rules</h2>
      <p style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', margin: '-6px 0 16px' }}>
        The <strong>global</strong> rule applies to every treatment. Add a per-treatment rule to override it (e.g. a longer treatment that needs a later last-slot cutoff).
      </p>

      {rules.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No slot rules yet — add a global rule to enable online booking.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rules.map(r => (
          <div key={r.id} style={{ border: '1px solid #F0ECE6', borderRadius: 6, padding: 16, opacity: r.is_active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ font: '600 13px Inter,sans-serif', color: '#3B5249' }}>{label(r)}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => patch(r.id, 'is_active', !r.is_active)} style={btnGhost}>{r.is_active ? 'Active' : 'Inactive'}</button>
                <button onClick={() => del(r.id)} style={btnDanger}>Delete</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {DOW.map((d, i) => (
                <button key={i} onClick={() => toggleDay(r.id, i)} style={{
                  width: 42, padding: '6px 0', borderRadius: 4, cursor: 'pointer',
                  border: '1px solid ' + (r.day_of_week.includes(i) ? '#3B5249' : 'var(--color-border)'),
                  background: r.day_of_week.includes(i) ? '#3B5249' : '#fff',
                  color: r.day_of_week.includes(i) ? '#fff' : '#9B9390',
                  font: '500 11px Inter,sans-serif',
                }}>{d}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
              <Field label="First slot"><input className="input" type="time" value={r.first_slot} onChange={e => patch(r.id, 'first_slot', e.target.value)} /></Field>
              <Field label="Last slot"><input className="input" type="time" value={r.last_slot} onChange={e => patch(r.id, 'last_slot', e.target.value)} /></Field>
              <Field label="Interval (min)"><input className="input" type="number" min="5" step="5" value={r.slot_interval} onChange={e => patch(r.id, 'slot_interval', Number(e.target.value))} /></Field>
              <Field label="Max concurrent"><input className="input" type="number" min="1" value={r.max_concurrent} onChange={e => patch(r.id, 'max_concurrent', Number(e.target.value))} /></Field>
            </div>

            <button onClick={() => save(r)} disabled={savingId === r.id} style={btnPrimary}>{savingId === r.id ? 'Saving…' : 'Save rule'}</button>
          </div>
        ))}
      </div>

      {err && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 12 }}>{err}</p>}

      <div style={{ marginTop: 16 }}>
        {adding ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={newScope} onChange={e => setNewScope(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="" disabled={hasGlobal}>Global — all treatments{hasGlobal ? ' (exists)' : ''}</option>
              {availableTreatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={create} style={btnPrimary}>Create</button>
            <button onClick={() => { setAdding(false); setErr('') }} style={btnGhost}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => { setAdding(true); setNewScope(hasGlobal ? (availableTreatments[0]?.id ?? '') : '') }} style={btnPrimary}>+ Add slot rule</button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', font: '500 11px Inter,sans-serif', color: '#6B6663', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

/* ─────────────────────── BLOCKED DATES ─────────────────────── */
function BlockedDates({ blocks, setBlocks, therapists }) {
  const now = new Date()
  const [viewY, setViewY] = useState(now.getFullYear())
  const [viewM, setViewM] = useState(now.getMonth())
  const [scope, setScope] = useState('') // '' = whole spa, else therapist_id
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const today = todayStr()
  const scopeBlocks = blocks.filter(b => (scope ? b.therapist_id === scope : !b.therapist_id))
  const blockByDate = Object.fromEntries(scopeBlocks.map(b => [b.date, b]))

  const firstDow = new Date(viewY, viewM, 1).getDay()
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const shiftMonth = (delta) => {
    let m = viewM + delta, y = viewY
    if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
    setViewM(m); setViewY(y)
  }

  const toggle = async (day) => {
    const date = ymd(viewY, viewM, day)
    if (date < today) return
    const existing = blockByDate[date]
    setBusy(true)
    if (existing) {
      const res = await fetch(`/api/admin/blocked-dates/${existing.id}`, { method: 'DELETE' })
      if (res.ok) setBlocks(bs => bs.filter(b => b.id !== existing.id))
    } else {
      const res = await fetch('/api/admin/blocked-dates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, therapist_id: scope || null, reason: reason || null }),
      })
      const data = await res.json()
      if (res.ok) setBlocks(bs => [...bs, data.block].sort((a, b) => a.date.localeCompare(b.date)))
    }
    setBusy(false)
  }

  const removeBlock = async (id) => {
    const res = await fetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' })
    if (res.ok) setBlocks(bs => bs.filter(b => b.id !== id))
  }

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Blocked Dates</h2>
      <p style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', margin: '-6px 0 16px' }}>
        Click a date to close it for booking (holidays, private events, days off). A whole-spa block hides all slots that day; a therapist block only affects that person.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ font: '500 12px Inter,sans-serif', color: '#6B6663' }}>Block for:</label>
        <select className="input" value={scope} onChange={e => setScope(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Whole spa</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="input" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
      </div>

      {/* Calendar */}
      <div style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 14, maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => shiftMonth(-1)} style={btnGhost}>←</button>
          <div style={{ font: '500 14px Inter,sans-serif', color: '#1C1917' }}>{MONTHS[viewM]} {viewY}</div>
          <button onClick={() => shiftMonth(1)} style={btnGhost}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
          {DOW.map(d => <div key={d} style={{ font: '600 10px Inter,sans-serif', color: '#9B9390', padding: '4px 0' }}>{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const date = ymd(viewY, viewM, day)
            const isPast = date < today
            const blocked = !!blockByDate[date]
            return (
              <button key={i} onClick={() => toggle(day)} disabled={isPast || busy} title={blockByDate[date]?.reason || ''}
                style={{
                  aspectRatio: '1', borderRadius: 6, cursor: isPast ? 'default' : 'pointer',
                  border: '1px solid ' + (blocked ? '#DC2626' : '#F0ECE6'),
                  background: blocked ? '#FEE2E2' : (date === today ? '#E8EDE9' : '#fff'),
                  color: isPast ? '#D6D1CB' : (blocked ? '#991B1B' : '#1C1917'),
                  font: '500 12px Inter,sans-serif',
                }}>
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Upcoming blocked list */}
      <div style={{ marginTop: 18 }}>
        <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', color: '#9B9390', marginBottom: 8 }}>Upcoming blocked days</div>
        {blocks.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>None scheduled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocks.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: '#FAF6F0', borderRadius: 6 }}>
                <div style={{ font: '400 13px Inter,sans-serif', color: '#1C1917' }}>
                  {b.date}
                  <span style={{ color: '#9B9390' }}> · {b.therapist_id ? (therapists.find(t => t.id === b.therapist_id)?.name ?? 'Therapist') : 'Whole spa'}</span>
                  {b.reason && <span style={{ color: '#9B9390' }}> · {b.reason}</span>}
                </div>
                <button onClick={() => removeBlock(b.id)} style={btnDanger}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────── THERAPISTS ─────────────────────── */
function Therapists({ therapists, setTherapists }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/therapists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, specialties: specialties.split(',').map(s => s.trim()).filter(Boolean), sort_order: therapists.length }),
    })
    setSaving(false)
    if (res.ok) {
      const { therapist } = await res.json()
      setTherapists(ts => [...ts, therapist])
      setName(''); setSpecialties(''); setAdding(false)
    }
  }

  const toggle = async (t) => {
    const res = await fetch(`/api/admin/therapists/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    })
    if (res.ok) setTherapists(ts => ts.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
  }

  const del = async (id) => {
    if (!confirm('Delete this therapist? Their blocked days will also be removed.')) return
    const res = await fetch(`/api/admin/therapists/${id}`, { method: 'DELETE' })
    if (res.ok) setTherapists(ts => ts.filter(t => t.id !== id))
  }

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Therapists</h2>
      <p style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', margin: '-6px 0 16px' }}>
        Optional. Add therapists to block individual days off above. Leave empty if you manage availability at the whole-spa level.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {therapists.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', border: '1px solid #F0ECE6', borderRadius: 6, opacity: t.is_active ? 1 : 0.55 }}>
            <div>
              <div style={{ font: '600 13px Inter,sans-serif' }}>{t.name}</div>
              {t.specialties?.length > 0 && <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{t.specialties.join(', ')}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggle(t)} style={btnGhost}>{t.is_active ? 'Active' : 'Inactive'}</button>
              <button onClick={() => del(t.id)} style={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
        {therapists.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No therapists added.</p>}
      </div>

      <div style={{ marginTop: 14 }}>
        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <input className="input" placeholder="Therapist name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Specialties (comma-separated, optional)" value={specialties} onChange={e => setSpecialties(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={create} disabled={saving || !name} style={btnPrimary}>{saving ? 'Saving…' : 'Add therapist'}</button>
              <button onClick={() => setAdding(false)} style={btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add therapist</button>
        )}
      </div>
    </div>
  )
}
