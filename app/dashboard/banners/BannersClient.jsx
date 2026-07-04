'use client'

import { useState } from 'react'
import { resizeImageForUpload } from '@/lib/resize-image'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

const card = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }
const label = { display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }
const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', font: '600 13px Inter,sans-serif', cursor: 'pointer' }
const btnGhost = { padding: '7px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#1C1917', font: '500 12px Inter,sans-serif', cursor: 'pointer' }

const CTA_TYPES = [
  { value: 'none',     label: 'No button' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call',     label: 'Phone call' },
  { value: 'url',      label: 'Custom link' },
]

const today = () => new Date().toISOString().slice(0, 10)

function emptyForm(defaultWhatsapp) {
  return {
    id: null, name: '', message: '', image_url: '',
    cta_type: 'none', cta_label: '', cta_value: '',
    trigger_type: 'immediate', delay_seconds: 10,
    schedule: 'always', start_date: '', end_date: '',
    is_active: true, priority: 0,
    _defaultWhatsapp: defaultWhatsapp,
  }
}

function status(b) {
  const t = today()
  if (!b.is_active) return { label: 'Inactive', color: '#9B9390' }
  if (b.start_date && b.start_date > t) return { label: 'Scheduled', color: '#C4924A' }
  if (b.end_date && b.end_date < t) return { label: 'Expired', color: '#9B9390' }
  return { label: 'Active', color: '#3B5249' }
}

export default function BannersClient({ initialBanners, defaultWhatsapp }) {
  const [banners, setBanners] = useState(initialBanners)
  const [form, setForm] = useState(null) // null = list view, object = editing/creating
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openNew = () => setForm(emptyForm(defaultWhatsapp))
  const openEdit = (b) => setForm({
    ...b,
    schedule: (b.start_date || b.end_date) ? 'range' : 'always',
    start_date: b.start_date ?? '', end_date: b.end_date ?? '',
    delay_seconds: b.delay_seconds ?? 10,
    _defaultWhatsapp: defaultWhatsapp,
  })
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
    if (!form.name.trim() || !form.message.trim()) {
      setError('Name and message are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      name: form.name, message: form.message, image_url: form.image_url || null,
      cta_type: form.cta_type,
      cta_label: form.cta_type === 'none' ? null : (form.cta_label || null),
      cta_value: form.cta_type === 'none' ? null : (form.cta_value || null),
      trigger_type: form.trigger_type,
      delay_seconds: form.trigger_type === 'delay' ? Number(form.delay_seconds) || 10 : null,
      start_date: form.schedule === 'range' ? (form.start_date || null) : null,
      end_date:   form.schedule === 'range' ? (form.end_date || null) : null,
      is_active: form.is_active,
      priority: Number(form.priority) || 0,
    }
    try {
      const res = form.id
        ? await fetch(`/api/admin/banners/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save banner')
      const saved = data.banner
      setBanners(prev => form.id ? prev.map(b => b.id === saved.id ? saved : b) : [saved, ...prev])
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this banner? This cannot be undone.')) return
    const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    if (res.ok) setBanners(prev => prev.filter(b => b.id !== id))
  }

  const toggleActive = async (b) => {
    const res = await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !b.is_active }),
    })
    if (res.ok) {
      const { banner } = await res.json()
      setBanners(prev => prev.map(x => x.id === banner.id ? banner : x))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <button onClick={openNew} style={btnPrimary}>+ New Banner</button>
      </div>

      <div style={card}>
        {banners.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 13px Inter,sans-serif' }}>No banners yet. Create one to show a popup on the public site.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9B9390', font: '600 10px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px 10px' }}>Name</th>
                <th style={{ padding: '6px 8px 10px' }}>Status</th>
                <th style={{ padding: '6px 8px 10px' }}>Trigger</th>
                <th style={{ padding: '6px 8px 10px' }}>Schedule</th>
                <th style={{ padding: '6px 8px 10px' }}>Priority</th>
                <th style={{ padding: '6px 8px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {banners.map(b => {
                const s = status(b)
                return (
                  <tr key={b.id} style={{ borderTop: '1px solid #F0ECE6' }}>
                    <td style={{ padding: '10px 8px', font: '600 13px Inter,sans-serif', color: '#1C1917', cursor: 'pointer' }} onClick={() => openEdit(b)}>{b.name}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ background: s.color + '1A', color: s.color, padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif' }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>
                      {b.trigger_type === 'delay' ? `After ${b.delay_seconds}s` : 'Immediate'}
                    </td>
                    <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>
                      {b.start_date || b.end_date ? `${b.start_date ?? '…'} → ${b.end_date ?? '…'}` : 'Always'}
                    </td>
                    <td style={{ padding: '10px 8px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{b.priority}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => toggleActive(b)} style={{ ...btnGhost, marginRight: 6 }}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => openEdit(b)} style={{ ...btnGhost, marginRight: 6 }}>Edit</button>
                      <button onClick={() => handleDelete(b.id)} style={{ ...btnGhost, color: '#DC2626', borderColor: '#FCA5A5' }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {banners.length > 1 && (
        <p style={{ font: '400 12px Inter,sans-serif', color: '#9B9390' }}>
          Only the single highest-priority eligible banner is shown to a visitor at a time — if several are active/scheduled for the same dates, raise the priority number on the one that should win.
        </p>
      )}

      {form && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#FAF6F0', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: '#FAF6F0' }}>
              <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#1C1917' }}>{form.id ? 'Edit Banner' : 'New Banner'}</div>
              <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9B9390', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={label}>Internal name</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Songkran 2026" />
              </div>

              <div>
                <label style={label}>Message</label>
                <textarea className="input" rows={3} style={{ resize: 'vertical' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What should visitors see?" />
              </div>

              <div>
                <label style={label}>Photo (optional)</label>
                {form.image_url && (
                  <div style={{ position: 'relative', marginBottom: 8, width: 160, height: 100, borderRadius: 6, overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setForm(f => ({ ...f, image_url: '' }))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(28,25,23,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer' }}>×</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImage} disabled={uploading} />
                {uploading && <span style={{ marginLeft: 8, font: '400 12px Inter,sans-serif', color: '#9B9390' }}>Uploading…</span>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Trigger</label>
                  <select className="input" value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                    <option value="immediate">Show immediately</option>
                    <option value="delay">Show after a delay</option>
                  </select>
                </div>
                {form.trigger_type === 'delay' && (
                  <div style={{ flex: 1 }}>
                    <label style={label}>Delay (seconds)</label>
                    <input className="input" type="number" min={1} value={form.delay_seconds} onChange={e => setForm(f => ({ ...f, delay_seconds: e.target.value }))} />
                  </div>
                )}
              </div>

              <div>
                <label style={label}>Schedule</label>
                <select className="input" value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}>
                  <option value="always">Always (while active)</option>
                  <option value="range">Specific date range</option>
                </select>
              </div>
              {form.schedule === 'range' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Start date (optional)</label>
                    <input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>End date (optional)</label>
                    <input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
              )}

              <div>
                <label style={label}>Call-to-action button</label>
                <select className="input" value={form.cta_type} onChange={e => setForm(f => ({ ...f, cta_type: e.target.value }))}>
                  {CTA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {form.cta_type !== 'none' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Button text</label>
                    <input className="input" value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))} placeholder="Learn more" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>
                      {form.cta_type === 'url' ? 'Link URL' : form.cta_type === 'whatsapp' ? 'WhatsApp number (optional)' : 'Phone number (optional)'}
                    </label>
                    <input
                      className="input" value={form.cta_value}
                      onChange={e => setForm(f => ({ ...f, cta_value: e.target.value }))}
                      placeholder={form.cta_type === 'url' ? 'https://…' : `Defaults to ${form._defaultWhatsapp || 'the site\'s WhatsApp number'}`}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Priority (higher wins if multiple are eligible)</label>
                  <input className="input" type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px Inter,sans-serif', color: '#1C1917' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    Active
                  </label>
                </div>
              </div>

              {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Banner'}</button>
                <button onClick={close} style={btnGhost}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
