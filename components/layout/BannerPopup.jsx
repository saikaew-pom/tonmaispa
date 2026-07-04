'use client'

import { useState, useEffect } from 'react'

const DISMISS_PREFIX = 'tonmai_banner_dismissed_'

function ctaHref(banner) {
  if (!banner.cta_value) return null
  if (banner.cta_type === 'whatsapp') return `https://wa.me/${banner.cta_value.replace(/\D/g, '')}`
  if (banner.cta_type === 'call') return `tel:+${banner.cta_value.replace(/\D/g, '')}`
  if (banner.cta_type === 'url') return banner.cta_value
  return null
}

export default function BannerPopup() {
  const [banner, setBanner] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer = null

    fetch('/api/banners/active').then(r => r.json()).then(({ banner: b }) => {
      if (cancelled || !b) return

      const dismissKey = DISMISS_PREFIX + b.id + '_' + b.updated_at
      if (localStorage.getItem(dismissKey) === '1') return

      setBanner(b)
      if (b.trigger_type === 'delay') {
        timer = setTimeout(() => setVisible(true), (b.delay_seconds ?? 10) * 1000)
      } else {
        setVisible(true)
      }
    }).catch(() => {})

    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [])

  if (!banner || !visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_PREFIX + banner.id + '_' + banner.updated_at, '1')
    setVisible(false)
  }

  const href = ctaHref(banner)

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FAF6F0', borderRadius: 14, overflow: 'hidden', maxWidth: 420, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative',
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(28,25,23,0.55)', color: '#fff', border: 'none', fontSize: 18,
            lineHeight: 1, cursor: 'pointer', zIndex: 1,
          }}
        >
          ×
        </button>

        {banner.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.image_url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        )}

        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ font: '400 16px/1.5 Inter,sans-serif', color: '#1C1917', margin: '0 0 18px' }}>{banner.message}</p>

          {href && (
            <a
              href={href}
              target={banner.cta_type === 'url' ? '_blank' : undefined}
              rel={banner.cta_type === 'url' ? 'noopener noreferrer' : undefined}
              onClick={dismiss}
              style={{
                display: 'inline-block', background: '#3B5249', color: '#fff', textDecoration: 'none',
                padding: '12px 28px', borderRadius: 6, font: '600 13px Inter,sans-serif',
              }}
            >
              {banner.cta_label || 'Learn more'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
