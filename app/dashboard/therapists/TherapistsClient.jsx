'use client'

import { useState, useEffect } from 'react'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayStr = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()) }

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20 }
const sectionTitle = { font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }
const btnDanger = { background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }

export default function TherapistsClient({ initialTherapists, treatments, initialCapabilities }) {
  const [therapists, setTherapists] = useState(initialTherapists)
  const [capabilities, setCapabilities] = useState(() => {
    const map = {}
    for (const c of initialCapabilities) (map[c.therapist_id] ??= new Set()).add(c.treatment_id)
    return map
  })
  const [selectedId, setSelectedId] = useState(initialTherapists[0]?.id ?? null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = therapists.find(t => t.id === selectedId)

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
      setSelectedId(therapist.id)
      setName(''); setSpecialties(''); setAdding(false)
    }
  }

  const toggleActive = async (t) => {
    const res = await fetch(`/api/admin/therapists/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    })
    if (res.ok) setTherapists(ts => ts.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
  }

  const del = async (id) => {
    if (!confirm('Delete this therapist? Their shifts, capabilities and blocked days will also be removed.')) return
    const res = await fetch(`/api/admin/therapists/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTherapists(ts => ts.filter(t => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  const saveCapabilities = async (treatmentIds) => {
    const res = await fetch(`/api/admin/therapists/${selectedId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treatment_ids: [...treatmentIds] }),
    })
    if (res.ok) setCapabilities(caps => ({ ...caps, [selectedId]: new Set(treatmentIds) }))
    return res.ok
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Therapist list */}
      <div style={card}>
        <h2 style={sectionTitle}>All Therapists</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {therapists.map(t => (
            <div key={t.id} onClick={() => setSelectedId(t.id)}
              style={{ padding: '10px 12px', border: '1px solid ' + (selectedId === t.id ? '#3B5249' : '#F0ECE6'), borderRadius: 6, cursor: 'pointer', background: selectedId === t.id ? '#F0F4F2' : '#fff', opacity: t.is_active ? 1 : 0.55 }}>
              <div style={{ font: '600 13px Inter,sans-serif' }}>{t.name}</div>
              {t.specialties?.length > 0 && <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{t.specialties.join(', ')}</div>}
            </div>
          ))}
          {therapists.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No therapists yet.</p>}
        </div>

        <div style={{ marginTop: 14 }}>
          {adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input" placeholder="Therapist name" value={name} onChange={e => setName(e.target.value)} />
              <input className="input" placeholder="Specialties (comma-separated, optional)" value={specialties} onChange={e => setSpecialties(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={create} disabled={saving || !name} style={btnPrimary}>{saving ? 'Saving…' : 'Add'}</button>
                <button onClick={() => setAdding(false)} style={btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ ...btnPrimary, width: '100%' }}>+ Add therapist</button>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>{selected.name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleActive(selected)} style={btnGhost}>{selected.is_active ? 'Active' : 'Inactive'}</button>
                <button onClick={() => del(selected.id)} style={btnDanger}>Delete</button>
              </div>
            </div>
          </div>

          <CapabilityEditor
            treatments={treatments}
            selectedIds={capabilities[selected.id] ?? new Set()}
            onSave={saveCapabilities}
          />

          <ShiftCalendar therapistId={selected.id} />
        </div>
      ) : (
        <div style={card}>
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>Select a therapist to manage their treatments and schedule.</p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── CAPABILITY EDITOR ─────────────────────── */
function CapabilityEditor({ treatments, selectedIds, onSave }) {
  const [checked, setChecked] = useState(selectedIds)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => { setChecked(selectedIds) }, [selectedIds])

  const toggle = (id) => setChecked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const save = async () => {
    setSaving(true)
    const ok = await onSave(checked)
    setSaving(false)
    if (ok) { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1500) }
  }

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Treatments this therapist can perform</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8, marginBottom: 14 }}>
        {treatments.map(t => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #F0ECE6', borderRadius: 6, cursor: 'pointer', font: '400 13px Inter,sans-serif' }}>
            <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} />
            {t.name}
          </label>
        ))}
        {treatments.length === 0 && <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No treatments found.</p>}
      </div>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save treatments'}</button>
    </div>
  )
}

/* ─────────────────────── SHIFT CALENDAR ─────────────────────── */
function ShiftCalendar({ therapistId }) {
  const now = new Date()
  const [viewY, setViewY] = useState(now.getFullYear())
  const [viewM, setViewM] = useState(now.getMonth())
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editDate, setEditDate] = useState(null)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [splitShift, setSplitShift] = useState(false)
  const [breakStart, setBreakStart] = useState('')
  const [breakEnd, setBreakEnd] = useState('')
  const [busy, setBusy] = useState(false)
  // Multi-select: pick several dates, then apply one shift to all of them
  // at once instead of clicking through day-by-day.
  const [multiMode, setMultiMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [bulkMsg, setBulkMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/therapists/${therapistId}/shifts?year=${viewY}&month=${viewM + 1}`)
      .then(r => r.json())
      .then(d => setShifts(d.shifts ?? []))
      .finally(() => setLoading(false))
  }, [therapistId, viewY, viewM])

  const today = todayStr()
  const shiftByDate = Object.fromEntries(shifts.map(s => [s.date, s]))

  const firstDow = new Date(viewY, viewM, 1).getDay()
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const shiftMonth = (delta) => {
    let m = viewM + delta, y = viewY
    if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
    setViewM(m); setViewY(y); setEditDate(null)
  }

  const resetFields = (existing) => {
    setStartTime(existing ? existing.start_time.slice(0, 5) : '09:00')
    setEndTime(existing ? existing.end_time.slice(0, 5) : '18:00')
    const hasBreak = !!(existing?.break_start && existing?.break_end)
    setSplitShift(hasBreak)
    setBreakStart(hasBreak ? existing.break_start.slice(0, 5) : '')
    setBreakEnd(hasBreak ? existing.break_end.slice(0, 5) : '')
  }

  const openDay = (day) => {
    const date = ymd(viewY, viewM, day)
    if (date < today) return

    if (multiMode) {
      setSelectedDates(prev => {
        const next = new Set(prev)
        next.has(date) ? next.delete(date) : next.add(date)
        return next
      })
      setBulkMsg('')
      resetFields(null)
      return
    }

    setEditDate(date)
    resetFields(shiftByDate[date])
  }

  const saveShift = async () => {
    setBusy(true)
    const res = await fetch(`/api/admin/therapists/${therapistId}/shifts`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: editDate, start_time: startTime, end_time: endTime, break_start: splitShift ? breakStart : null, break_end: splitShift ? breakEnd : null }),
    })
    setBusy(false)
    if (res.ok) {
      const { shift } = await res.json()
      setShifts(ss => [...ss.filter(s => s.date !== editDate), shift])
      setEditDate(null)
    }
  }

  const clearShift = async () => {
    setBusy(true)
    const res = await fetch(`/api/admin/therapists/${therapistId}/shifts?date=${editDate}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) {
      setShifts(ss => ss.filter(s => s.date !== editDate))
      setEditDate(null)
    }
  }

  const applyBulk = async () => {
    if (!selectedDates.size) return
    setBusy(true)
    setBulkMsg('')
    const res = await fetch(`/api/admin/therapists/${therapistId}/shifts/bulk`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dates: [...selectedDates], start_time: startTime, end_time: endTime,
        break_start: splitShift ? breakStart : null, break_end: splitShift ? breakEnd : null,
      }),
    })
    setBusy(false)
    if (res.ok) {
      const { shifts: saved } = await res.json()
      const savedDates = new Set(saved.map(s => s.date))
      setShifts(ss => [...ss.filter(s => !savedDates.has(s.date)), ...saved])
      setBulkMsg(`Applied to ${saved.length} day${saved.length === 1 ? '' : 's'} ✓`)
      setSelectedDates(new Set())
    } else {
      setBulkMsg('Could not save — try again')
    }
  }

  const exitMultiMode = () => {
    setMultiMode(false)
    setSelectedDates(new Set())
    setBulkMsg('')
  }

  const enterMultiMode = () => {
    setMultiMode(true)
    setEditDate(null)
  }

  const scheduleFields = (
    <>
      <div>
        <label style={{ display: 'block', font: '500 11px Inter,sans-serif', color: '#6B6663', marginBottom: 4 }}>Start</label>
        <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
      </div>
      <div>
        <label style={{ display: 'block', font: '500 11px Inter,sans-serif', color: '#6B6663', marginBottom: 4 }}>End</label>
        <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #F0ECE6', paddingTop: 10, marginTop: 2, font: '500 12px Inter,sans-serif', color: '#1C1917', cursor: 'pointer' }}>
        <input type="checkbox" checked={splitShift} onChange={e => setSplitShift(e.target.checked)} />
        Split shift (add a break)
      </label>
      {splitShift && (
        <>
          <div>
            <label style={{ display: 'block', font: '500 11px Inter,sans-serif', color: '#6B6663', marginBottom: 4 }}>Break start</label>
            <input className="input" type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', font: '500 11px Inter,sans-serif', color: '#6B6663', marginBottom: 4 }}>Break end</label>
            <input className="input" type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)} />
          </div>
        </>
      )}
    </>
  )

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={sectionTitle}>Working schedule</h2>
          <p style={{ font: '400 12px/1.6 Inter,sans-serif', color: '#6B6663', margin: '-6px 0 16px' }}>
            {multiMode
              ? 'Click dates to select them, set hours on the right, then apply to all selected days at once.'
              : "Click a date to set this therapist's exact working hours, or clear it to mark them off that day. No shift set = not working."}
          </p>
        </div>
        <button onClick={multiMode ? exitMultiMode : enterMultiMode} style={multiMode ? btnPrimary : btnGhost}>
          {multiMode ? `Exit multi-select (${selectedDates.size} selected)` : 'Select multiple days'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
        <div style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 14, opacity: loading ? 0.5 : 1 }}>
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
              const shift = shiftByDate[date]
              const isSelected = multiMode ? selectedDates.has(date) : editDate === date
              return (
                <button key={i} onClick={() => openDay(day)} disabled={isPast}
                  style={{
                    aspectRatio: '1', borderRadius: 6, cursor: isPast ? 'default' : 'pointer',
                    border: '1px solid ' + (isSelected ? '#C4924A' : shift ? '#3B5249' : '#F0ECE6'),
                    background: isSelected ? '#FBF3E7' : shift ? '#E8EDE9' : (date === today ? '#FAF6F0' : '#fff'),
                    color: isPast ? '#D6D1CB' : '#1C1917',
                    font: '500 12px Inter,sans-serif',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                  }}>
                  <span>{day}</span>
                  {shift && <span style={{ font: '400 8px Inter,sans-serif', color: '#3B5249' }}>{shift.start_time.slice(0,5)}{shift.break_start ? ' ⁚' : ''}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {multiMode ? (
          <div style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 16 }}>
            <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917', marginBottom: 12 }}>{selectedDates.size} day{selectedDates.size === 1 ? '' : 's'} selected</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scheduleFields}
              <button onClick={applyBulk} disabled={busy || !selectedDates.size} style={{ ...btnPrimary, opacity: selectedDates.size ? 1 : 0.5 }}>
                {busy ? 'Applying…' : `Apply to ${selectedDates.size} day${selectedDates.size === 1 ? '' : 's'}`}
              </button>
              {bulkMsg && <p style={{ font: '400 12px Inter,sans-serif', color: bulkMsg.includes('✓') ? '#3B5249' : '#DC2626', margin: 0 }}>{bulkMsg}</p>}
            </div>
          </div>
        ) : editDate ? (
          <div style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 16 }}>
            <div style={{ font: '600 12px Inter,sans-serif', color: '#1C1917', marginBottom: 12 }}>{editDate}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scheduleFields}
              <button onClick={saveShift} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save shift'}</button>
              {shiftByDate[editDate] && <button onClick={clearShift} disabled={busy} style={btnDanger}>Clear (day off)</button>}
              <button onClick={() => setEditDate(null)} style={btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid #F0ECE6', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#9B9390', font: '400 12px Inter,sans-serif', textAlign: 'center' }}>Click a date to edit</p>
          </div>
        )}
      </div>
    </div>
  )
}
