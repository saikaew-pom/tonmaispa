'use client'

import { useState } from 'react'
import Image from 'next/image'
import GalleryLightbox from '@/components/ui/GalleryLightbox'

export default function TreatmentGallery({ photos, treatmentName }) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const lightboxPhotos = photos.map((src, i) => ({ src, alt: `${treatmentName} — photo ${i + 1}` }))

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
        {photos.map((src, i) => (
          <div key={src} onClick={() => setActiveIndex(i)}
            style={{ position: 'relative', height: photos.length === 1 ? 360 : 160, borderRadius: 6, overflow: 'hidden', cursor: 'zoom-in' }}>
            <Image src={src} alt={`${treatmentName} — photo ${i + 1}`} fill sizes="(max-width: 768px) 50vw, 200px" style={{ objectFit: 'cover' }} />
          </div>
        ))}
      </div>

      <GalleryLightbox
        photos={lightboxPhotos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(-1)}
        onNavigate={setActiveIndex}
      />
    </>
  )
}
