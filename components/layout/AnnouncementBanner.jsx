'use client'

import { useState, useEffect } from 'react'

const DISMISS_PREFIX = 'tonmai_announcement_dismissed_'

export default function AnnouncementBanner({ text, link, linkLabel }) {
  const [dismissed, setDismissed] = useState(true) // start hidden; only show once we know it wasn't dismissed (avoids flash)

  useEffect(() => {
    if (!text) return
    const key = DISMISS_PREFIX + hash(text)
    setDismissed(localStorage.getItem(key) === '1')
  }, [text])

  if (!text || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_PREFIX + hash(text), '1')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'relative', zIndex: 60, background: '#3B5249', color: '#fff',
      padding: '10px 44px 10px 16px', textAlign: 'center',
      font: '500 13px Inter,sans-serif', lineHeight: 1.4,
    }}>
      <span>{text}</span>
      {link && (
        <a href={link} style={{ color: '#fff', textDecoration: 'underline', marginLeft: 8, fontWeight: 600 }}>
          {linkLabel || 'Learn more'}
        </a>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', color: '#fff', opacity: 0.8,
          fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 4,
        }}
      >
        ×
      </button>
    </div>
  )
}

// Tiny non-crypto hash so the dismissal key changes when the announcement
// text changes — an edited/new announcement re-shows even if a previous
// one was dismissed, without needing a DB-stored "version" field.
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0 }
  return h
}
