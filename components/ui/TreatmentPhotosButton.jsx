'use client'

import { useState } from 'react'
import GalleryLightbox from './GalleryLightbox'

// Self-contained: manages its own lightbox state so it can drop into a
// server-rendered treatment card without converting the whole card to
// a client component.
export default function TreatmentPhotosButton({ photos, treatmentName, style }) {
  const [activeIndex, setActiveIndex] = useState(-1)

  if (!photos?.length) return null

  const lightboxPhotos = photos.map((src, i) => ({ src, alt: `${treatmentName} — photo ${i + 1}` }))

  return (
    <>
      <button
        onClick={() => setActiveIndex(0)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid #3B5249', color: '#3B5249',
          borderRadius: 999, padding: '6px 14px', font: '600 10px Inter,sans-serif',
          letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
          ...style,
        }}
      >
        <span aria-hidden="true">📷</span> View Photos ({photos.length})
      </button>

      <GalleryLightbox
        photos={lightboxPhotos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(-1)}
        onNavigate={setActiveIndex}
      />
    </>
  )
}
