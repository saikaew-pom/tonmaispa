'use client'

import { useState } from 'react'

const BOOLEAN_KEYS = [
  'settings.booking_engine_enabled',
  'settings.chatbot_enabled',
  'settings.announcement_enabled',
  'settings.maintenance_mode',
]

const TEXTAREA_KEYS = ['settings.homepage_services_subheading']
const NUMBER_KEYS   = ['settings.homepage_services_count']

const GROUPS = [
  {
    title: 'Contact & Social',
    keys: ['settings.whatsapp_number', 'settings.line_id', 'settings.instagram_url', 'settings.facebook_url', 'settings.google_maps_url'],
  },
  {
    title: 'Business Info',
    keys: ['settings.opening_hours', 'settings.day_pass_price', 'settings.google_rating', 'settings.google_review_count'],
  },
  {
    title: 'Homepage — Services Section',
    keys: ['settings.homepage_services_heading', 'settings.homepage_services_subheading', 'settings.homepage_services_count'],
  },
  {
    title: 'Feature Toggles',
    keys: ['settings.booking_engine_enabled', 'settings.chatbot_enabled', 'settings.chatbot_booking_mode', 'settings.announcement_enabled', 'settings.maintenance_mode'],
  },
]

const LABELS = {
  'settings.whatsapp_number':             'WhatsApp number (no +)',
  'settings.line_id':                     'Line ID',
  'settings.instagram_url':               'Instagram URL',
  'settings.facebook_url':                'Facebook URL',
  'settings.google_maps_url':             'Google Maps URL',
  'settings.opening_hours':               'Opening hours',
  'settings.day_pass_price':              'Day pass price (THB)',
  'settings.google_rating':               'Google rating',
  'settings.google_review_count':         'Google review count',
  'settings.homepage_services_heading':    'Section heading',
  'settings.homepage_services_subheading': 'Section subheading',
  'settings.homepage_services_count':      'How many treatments to show (1–9)',
  'settings.booking_engine_enabled':      'Booking engine enabled',
  'settings.chatbot_enabled':             'Chatbot enabled',
  'settings.chatbot_booking_mode':        'Chatbot booking mode (simple / full)',
  'settings.announcement_enabled':        'Announcement banner enabled',
  'settings.maintenance_mode':            'Maintenance mode',
}

export default function SettingsClient({ initialSettings }) {
  const [values, setValues] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const setValue = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    setSaved(res.ok)
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {GROUPS.map(group => (
        <div key={group.title} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h2 style={{ font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }}>{group.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.keys.map(key => (
              <div key={key}>
                <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>{LABELS[key] ?? key}</label>
                {BOOLEAN_KEYS.includes(key) ? (
                  <input
                    type="checkbox"
                    checked={values[key] === 'true'}
                    onChange={e => setValue(key, e.target.checked ? 'true' : 'false')}
                    style={{ width: 18, height: 18 }}
                  />
                ) : TEXTAREA_KEYS.includes(key) ? (
                  <textarea className="input" rows={3} style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }} value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                ) : NUMBER_KEYS.includes(key) ? (
                  <input className="input" type="number" min={1} max={9} value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                ) : (
                  <input className="input" value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} style={{ background: '#3B5249', color: '#fff', border: 'none', borderRadius: 4, padding: '11px 22px', font: '600 12px Inter,sans-serif', cursor: 'pointer' }}>
        {saving ? 'Saving…' : 'Save All Settings'}
      </button>
      {saved && <span style={{ marginLeft: 12, color: '#065F46', font: '500 12px Inter,sans-serif' }}>Saved ✓</span>}
    </div>
  )
}
