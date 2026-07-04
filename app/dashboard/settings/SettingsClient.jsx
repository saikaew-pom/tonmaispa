'use client'

import { useState } from 'react'

const BOOLEAN_KEYS = [
  'settings.booking_engine_enabled',
  'settings.chatbot_enabled',
  'settings.maintenance_mode',
  'settings.insights_enabled',
  'settings.campaigns_enabled',
]

// Toggles whose stored value is a pair of words rather than 'true'/'false'
const WORD_TOGGLE_KEYS = {
  'settings.chatbot_booking_mode': { on: 'full', off: 'simple' },
}

const TEXTAREA_KEYS = ['settings.homepage_services_subheading']
const NUMBER_KEYS   = ['settings.homepage_services_count']

// Keys an `owner` account is allowed to see and change — everything else
// (contact info, business info, homepage copy, and every toggle except the
// two operational ones) is super_admin-only, enforced here for display and
// again server-side in app/api/admin/settings/route.js.
const OWNER_ALLOWED_KEYS = ['settings.maintenance_mode']

const FULL_GROUPS = [
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
    keys: [
      'settings.booking_engine_enabled', 'settings.chatbot_enabled', 'settings.chatbot_booking_mode',
      'settings.insights_enabled', 'settings.campaigns_enabled',
      'settings.maintenance_mode',
    ],
  },
]

function groupsForRole(role) {
  if (role !== 'owner') return FULL_GROUPS
  return [{ title: 'Feature Toggles', keys: OWNER_ALLOWED_KEYS }]
}

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
  'settings.chatbot_booking_mode':        'Chatbot full booking mode',
  'settings.insights_enabled':            'Revenue & Marketing Advisor enabled',
  'settings.campaigns_enabled':           'AI Campaign Planner enabled',
  'settings.maintenance_mode':            'Maintenance mode',
}

const HINTS = {
  'settings.insights_enabled':      'Premium feature — gate this for clients who haven\'t paid for AI analytics access.',
  'settings.campaigns_enabled':     'Premium feature — gate this for clients who haven\'t paid for AI analytics access.',
  'settings.chatbot_booking_mode':  'Off = chatbot only captures name/phone for staff follow-up. On = chatbot checks real availability and books directly. Requires "Booking engine enabled" above to also be on.',
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: 'none', padding: 2,
        background: checked ? '#3B5249' : '#D8D2C8', cursor: 'pointer',
        display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 160ms ease', flexShrink: 0,
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block',
        transition: 'transform 160ms ease',
      }} />
    </button>
  )
}

export default function SettingsClient({ initialSettings, role }) {
  const [values, setValues] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const GROUPS = groupsForRole(role)
  const editableKeys = GROUPS.flatMap(g => g.keys)

  const setValue = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    // Only send keys this role can actually edit — an owner's save must
    // never include the other keys just because they're in initialSettings,
    // or the server-side check (which mirrors this same restriction) rejects it.
    const payload = Object.fromEntries(editableKeys.map(k => [k, values[k]]))
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    setSaved(res.ok)
    if (!res.ok) setError(data.error || 'Could not save settings')
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {GROUPS.map(group => (
        <div key={group.title} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h2 style={{ font: '600 12px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', margin: '0 0 14px' }}>{group.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.keys.map(key => (
              <div key={key}>
                {BOOLEAN_KEYS.includes(key) ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
                    <div>
                      <div style={{ font: '500 13px Inter,sans-serif', color: '#1C1917' }}>{LABELS[key] ?? key}</div>
                      {HINTS[key] && <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2, maxWidth: 380 }}>{HINTS[key]}</div>}
                    </div>
                    <ToggleSwitch checked={values[key] === 'true'} onChange={v => setValue(key, v ? 'true' : 'false')} />
                  </div>
                ) : WORD_TOGGLE_KEYS[key] ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
                    <div>
                      <div style={{ font: '500 13px Inter,sans-serif', color: '#1C1917' }}>{LABELS[key] ?? key}</div>
                      {HINTS[key] && <div style={{ font: '400 11px Inter,sans-serif', color: '#9B9390', marginTop: 2, maxWidth: 380 }}>{HINTS[key]}</div>}
                    </div>
                    <ToggleSwitch
                      checked={values[key] === WORD_TOGGLE_KEYS[key].on}
                      onChange={v => setValue(key, v ? WORD_TOGGLE_KEYS[key].on : WORD_TOGGLE_KEYS[key].off)}
                    />
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', font: '500 12px Inter,sans-serif', color: '#4A4745', marginBottom: 4 }}>{LABELS[key] ?? key}</label>
                    {TEXTAREA_KEYS.includes(key) ? (
                      <textarea className="input" rows={3} style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }} value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                    ) : NUMBER_KEYS.includes(key) ? (
                      <input className="input" type="number" min={1} max={9} value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                    ) : (
                      <input className="input" value={values[key] ?? ''} onChange={e => setValue(key, e.target.value)} />
                    )}
                  </>
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
      {error && <p style={{ color: '#DC2626', font: '400 12px Inter,sans-serif', marginTop: 10 }}>{error}</p>}
    </div>
  )
}
