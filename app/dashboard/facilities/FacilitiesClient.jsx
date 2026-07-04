'use client'

import { useState } from 'react'
import Image from 'next/image'
import { resizeImageForUpload } from '@/lib/resize-image'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const label = { display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { padding: '7px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer' }

function emptyForm() {
  return { id: null, image_url: '', title: '', body: '', is_active: true }
}

export default function FacilitiesClient({ initialFacilities }) {
  const [facilities, setFacilities] = useState(initialFacilities)
  const [form, setForm] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openNew = () => setForm(emptyForm())
  const openEdit = (f) => setForm({ id: f.id, image_url: f.image_url, title: f.title ?? '', body: f.body ?? '', is_active: f.is_active })
  const close = () => { setForm(null); setError('') }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary is not configured (missing cloud name or upload preset).')
      return
    }
    setUploading(true)
    setError('')
    try {
      const resized = await resizeImageForUpload(file)
      const formData = new FormData()
      formData.append('file', resized)
      formData.append('upload_preset', UPLOAD_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
      setForm(f => ({ ...f, image_url: data.secure_url }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!form.image_url) {
      setError('Please upload a photo first.')
      return
    }
    setSaving(true)
    setError('')
    const payload = { image_url: form.image_url, title: form.title, body: form.body, is_active: form.is_active }
    try {
      const res = form.id
        ? await fetch(`/api/admin/facilities/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/facilities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      const saved = data.facility
      setFacilities(prev => form.id ? prev.map(f => f.id === saved.id ? saved : f) : [...prev, saved])
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this facility photo? This cannot be undone.')) return
    const res = await fetch(`/api/admin/facilities/${id}`, { method: 'DELETE' })
    if (res.ok) setFacilities(prev => prev.filter(f => f.id !== id))
  }

  const toggleActive = async (f) => {
    const res = await fetch(`/api/admin/facilities/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !f.is_active }),
    })
    if (res.ok) {
      const { facility } = await res.json()
      setFacilities(prev => prev.map(x => x.id === facility.id ? facility : x))
    }
  }

  const move = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= facilities.length) return
    const a = facilities[index], b = facilities[targetIndex]
    const next = [...facilities]
    next[index] = { ...a, sort_order: b.sort_order }
    next[targetIndex] = { ...b, sort_order: a.sort_order }
    next.sort((x, y) => x.sort_order - y.sort_order)
    setFacilities(next)
    await Promise.all([
      fetch(`/api/admin/facilities/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/admin/facilities/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <button onClick={openNew} style={btnPrimary}>+ Add Facility Photo</button>
      </div>

      <div style={card}>
        {facilities.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No facility photos yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {facilities.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, border: '1px solid #F0ECE6', borderRadius: 8, padding: 10, opacity: f.is_active ? 1 : 0.5 }}>
                <div style={{ position: 'relative', width: 80, height: 60, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                  <Image src={f.image_url} alt={f.title ?? ''} fill sizes="80px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ font: '600 13px Inter,sans-serif', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title || <em style={{ color: '#9B9390' }}>No title</em>}</div>
                  <div style={{ font: '400 12px Inter,sans-serif', color: '#6B6663', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.body}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...btnGhost, padding: '6px 10px', opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === facilities.length - 1} style={{ ...btnGhost, padding: '6px 10px', opacity: i === facilities.length - 1 ? 0.4 : 1 }}>↓</button>
                  </div>
                  <button onClick={() => toggleActive(f)} style={btnGhost}>{f.is_active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => openEdit(f)} style={btnGhost}>Edit</button>
                  <button onClick={() => handleDelete(f.id)} style={{ ...btnGhost, color: '#DC2626', borderColor: '#FCA5A5' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#FAF6F0', borderRadius: 12, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>{form.id ? 'Edit Facility' : 'New Facility'}</div>
              <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={label}>Photo</label>
                {form.image_url && (
                  <div style={{ position: 'relative', marginBottom: 8, width: 200, height: 130, borderRadius: 6, overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
                {uploading && <span style={{ marginLeft: 8, font: '400 12px Inter,sans-serif', color: '#9B9390' }}>Uploading…</span>}
              </div>

              <div>
                <label style={label}>Title (optional — leave blank for no caption)</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Herbal Steam Room" />
              </div>

              <div>
                <label style={label}>Caption (optional)</label>
                <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="One short sentence about this facility" />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px Inter,sans-serif', color: '#1C1917' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Show on homepage
              </label>

              {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={close} style={btnGhost}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
