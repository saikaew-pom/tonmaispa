'use client'

import { useState } from 'react'
import { TREATMENT_CATEGORIES } from '@/lib/display'

const CATEGORIES = Object.keys(TREATMENT_CATEGORIES)
const EMPTY_FORM = { name: '', category: 'massage', description: '', badge: '', durationsCsv: '60,90', pricesCsv: '600,850', is_active: true }

export default function TreatmentsClient({ initialTreatments }) {
  const [treatments, setTreatments] = useState(initialTreatments)
  const [editingId, setEditingId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const parseDurationsAndPrices = (durationsCsv, pricesCsv) => {
    const durations = durationsCsv.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean)
    const priceList  = pricesCsv.split(',').map(s => parseInt(s.trim(), 10))
    const prices = {}
    durations.forEach((d, i) => { if (priceList[i]) prices[String(d)] = priceList[i] })
    return { duration_options: durations, prices }
  }

  const handleCreate = async () => {
    setSaving(true)
    const { duration_options, prices } = parseDurationsAndPrices(newForm.durationsCsv, newForm.pricesCsv)
    const res = await fetch('/api/admin/treatments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, duration_options, prices }),
    })
    if (res.ok) {
      const { treatment } = await res.json()
      setTreatments(prev => [...prev, treatment])
      setNewForm(EMPTY_FORM)
      setShowNew(false)
    }
    setSaving(false)
  }

  const toggleActive = async (t) => {
    const res = await fetch(`/api/admin/treatments/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    })
    if (res.ok) setTreatments(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this treatment permanently?')) return
    const res = await fetch(`/api/admin/treatments/${id}`, { method: 'DELETE' })
    if (res.ok) setTreatments(prev => prev.filter(t => t.id !== id))
  }

  const handleSaveEdit = async (t, patch) => {
    const res = await fetch(`/api/admin/treatments/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { treatment } = await res.json()
      setTreatments(prev => prev.map(x => x.id === t.id ? treatment : x))
      setEditingId(null)
    }
  }

  return (
    <div>
      <button onClick={() => setShowNew(v => !v)} style={{ marginBottom: 16, background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
        {showNew ? 'Cancel' : '+ Add Treatment'}
      </button>

      {showNew && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 500 }}>
          <input className="input" placeholder="Treatment name" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
          <select className="input" value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{TREATMENT_CATEGORIES[c]}</option>)}
          </select>
          <input className="input" placeholder="Description" value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} />
          <input className="input" placeholder="Badge (optional, e.g. Signature)" value={newForm.badge} onChange={e => setNewForm(f => ({ ...f, badge: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Durations (mins, comma-sep) e.g. 60,90,120" value={newForm.durationsCsv} onChange={e => setNewForm(f => ({ ...f, durationsCsv: e.target.value }))} />
            <input className="input" placeholder="Prices (THB, matching order) e.g. 600,850,1100" value={newForm.pricesCsv} onChange={e => setNewForm(f => ({ ...f, pricesCsv: e.target.value }))} />
          </div>
          <button onClick={handleCreate} disabled={saving || !newForm.name} style={{ background: '#C4924A', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Create Treatment'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {treatments.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, opacity: t.is_active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ font: '600 14px Inter,sans-serif' }}>
                  {t.name} {t.badge && <span style={{ background: '#E8EDE9', color: '#3B5249', padding: '2px 8px', borderRadius: 999, font: '600 9px Inter,sans-serif', marginLeft: 6 }}>{t.badge}</span>}
                </div>
                <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{TREATMENT_CATEGORIES[t.category] ?? t.category}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditingId(editingId === t.id ? null : t.id)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>
                  {editingId === t.id ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => toggleActive(t)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 4, padding: '6px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {(t.duration_options ?? []).map(d => (
                <div key={d} style={{ font: '400 12px Inter,sans-serif', color: '#6B6663' }}>{d}min — ฿{t.prices?.[String(d)] ?? '—'}</div>
              ))}
            </div>

            {editingId === t.id && (
              <EditForm treatment={t} onSave={patch => handleSaveEdit(t, patch)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function EditForm({ treatment, onSave }) {
  const [name, setName] = useState(treatment.name)
  const [description, setDescription] = useState(treatment.description ?? '')
  const [badge, setBadge] = useState(treatment.badge ?? '')
  const [category, setCategory] = useState(treatment.category ?? 'massage')
  const [durationsCsv, setDurationsCsv] = useState((treatment.duration_options ?? []).join(','))
  const [pricesCsv, setPricesCsv] = useState((treatment.duration_options ?? []).map(d => treatment.prices?.[String(d)] ?? '').join(','))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const durations = durationsCsv.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean)
    const priceList = pricesCsv.split(',').map(s => parseInt(s.trim(), 10))
    const prices = {}
    durations.forEach((d, i) => { if (priceList[i]) prices[String(d)] = priceList[i] })
    await onSave({ name, description, badge: badge || null, category, duration_options: durations, prices })
    setSaving(false)
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0ECE6', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 500 }}>
      <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
        {CATEGORIES.map(c => <option key={c} value={c}>{TREATMENT_CATEGORIES[c]}</option>)}
      </select>
      <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
      <input className="input" value={badge} onChange={e => setBadge(e.target.value)} placeholder="Badge (optional)" />
      <div style={{ display: 'flex', gap: 10 }}>
        <input className="input" value={durationsCsv} onChange={e => setDurationsCsv(e.target.value)} placeholder="Durations e.g. 60,90,120" />
        <input className="input" value={pricesCsv} onChange={e => setPricesCsv(e.target.value)} placeholder="Prices e.g. 600,850,1100" />
      </div>
      <button onClick={handleSave} disabled={saving} style={{ background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
