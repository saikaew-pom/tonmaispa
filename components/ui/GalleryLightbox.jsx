'use client'

import { useEffect, useCallback } from 'react'
import Image from 'next/image'

const btnStyle = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '50%', width: 52, height: 52,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#fff', fontSize: 20, flexShrink: 0,
  transition: 'background 200ms', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
}

export default function GalleryLightbox({ photos, activeIndex, onClose, onNavigate }) {
  const n = photos.length

  const goPrev = useCallback((e) => { e?.stopPropagation(); onNavigate((activeIndex + n - 1) % n) }, [activeIndex, n, onNavigate])
  const goNext = useCallback((e) => { e?.stopPropagation(); onNavigate((activeIndex + 1) % n) }, [activeIndex, n, onNavigate])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  useEffect(() => {
    if (activeIndex < 0) return // not open — leave scrolling alone
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [activeIndex])

  if (activeIndex < 0) return null
  const photo = photos[activeIndex]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,8,6,0.97)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 20,
      }}
    >
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Image src="/logo-white.png" alt="Ton Mai Spa" width={140} height={46} style={{ height: 40, width: 'auto', opacity: 0.7 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ font: '400 13px Inter,sans-serif', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>{activeIndex + 1} / {n}</span>
          <button onClick={onClose} aria-label="Close gallery" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 28, lineHeight: 1, opacity: 0.7, padding: 4 }}>×</button>
        </div>
      </div>

      {/* Nav row */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 20, maxWidth: '100vw', width: '100%', justifyContent: 'center' }}>
        <button onClick={goPrev} aria-label="Previous photo" style={btnStyle}>←</button>
        <div style={{ position: 'relative', width: 'min(88vw, 1100px)', height: '76vh' }}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="88vw"
            style={{ objectFit: 'contain', borderRadius: 4 }}
          />
        </div>
        <button onClick={goNext} aria-label="Next photo" style={btnStyle}>→</button>
      </div>

      {/* Caption + dot strip */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ font: '400 13px/1.5 Inter,sans-serif', color: 'rgba(255,255,255,0.55)', margin: '0 0 14px', fontStyle: 'italic' }}>{photo.alt}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onNavigate(i) }}
              aria-label={`Go to photo ${i + 1}`}
              style={{
                width: i === activeIndex ? 22 : 6, height: 6, borderRadius: 3, border: 'none',
                cursor: 'pointer', padding: 0,
                background: i === activeIndex ? '#C4924A' : 'rgba(255,255,255,0.3)',
                transition: 'width .35s, background .35s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
