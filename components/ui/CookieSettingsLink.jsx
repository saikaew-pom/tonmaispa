'use client'

import { OPEN_CONSENT_EVENT } from '@/lib/consent'

export default function CookieSettingsLink({ style }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', ...style }}
    >
      Cookie Settings
    </button>
  )
}
