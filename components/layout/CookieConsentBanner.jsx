'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getStoredConsent, saveConsent, OPEN_CONSENT_EVENT } from '@/lib/consent'

export default function CookieConsentBanner() {
  const [visible, setVisible]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [analytics, setAnalytics] = useState(true) // pre-checked in the customize panel; nothing is set until they save
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true)

    const openSettings = () => { setExpanded(true); setVisible(true) }
    window.addEventListener(OPEN_CONSENT_EVENT, openSettings)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, openSettings)
  }, [])

  const decide = async (action, analyticsValue) => {
    setSaving(true)
    await saveConsent({ analytics: analyticsValue, action })
    setSaving(false)
    setVisible(false)
    setExpanded(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: '#1C1917', color: '#FAF6F0',
      padding: 'clamp(18px,3vw,28px) clamp(18px,4vw,40px)',
      boxShadow: '0 -8px 32px rgba(28,25,23,0.25)',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {!expanded ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, justifyContent: 'space-between' }}>
            <p style={{ font: '400 13px/1.65 Inter,sans-serif', color: 'rgba(250,246,240,0.85)', margin: 0, maxWidth: 620 }}>
              We use essential cookies to run this site, and — only with your permission — analytics cookies to understand how visitors use it.
              See our <Link href="/privacy" style={{ color: '#D9AE72', textDecoration: 'underline' }}>Privacy Policy</Link> for details.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setExpanded(true)} disabled={saving} style={btnGhost}>Customize</button>
              <button onClick={() => decide('reject_all', false)} disabled={saving} style={btnGhost}>Reject Non-Essential</button>
              <button onClick={() => decide('accept_all', true)} disabled={saving} style={btnPrimary}>Accept All</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#C4924A', marginBottom: 14 }}>
              Cookie Preferences
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <PreferenceRow
                title="Necessary"
                description="Required for the site to function — session handling, security, and remembering your cookie choice. Always on."
                checked
                disabled
              />
              <PreferenceRow
                title="Analytics"
                description="Google Analytics — helps us understand which pages and treatments visitors are interested in. No cookie is set unless you enable this."
                checked={analytics}
                onChange={setAnalytics}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={() => setExpanded(false)} disabled={saving} style={btnGhost}>Back</button>
              <button onClick={() => decide('save_preferences', analytics)} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PreferenceRow({ title, description, checked, disabled, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 14px', background: 'rgba(250,246,240,0.05)', borderRadius: 6, border: '1px solid rgba(250,246,240,0.1)' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: '#C4924A' }}
      />
      <div>
        <div style={{ font: '600 13px Inter,sans-serif', color: '#FAF6F0' }}>{title}{disabled ? ' (always on)' : ''}</div>
        <div style={{ font: '400 12px/1.6 Inter,sans-serif', color: 'rgba(250,246,240,0.65)', marginTop: 3 }}>{description}</div>
      </div>
    </div>
  )
}

const btnPrimary = { background: '#3B5249', color: '#fff', border: 'none', borderRadius: 2, padding: '11px 20px', font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost   = { background: 'none', color: '#FAF6F0', border: '1px solid rgba(250,246,240,0.3)', borderRadius: 2, padding: '11px 20px', font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
