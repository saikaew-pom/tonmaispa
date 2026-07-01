'use client'

import { useState } from 'react'
import Image from 'next/image'
import GalleryLightbox from '@/components/ui/GalleryLightbox'

const LOCAL_GALLERY = [
  { src: '/assets/outdoor-massage.jpg',  alt: 'Outdoor Thai massage sala in the garden' },
  { src: '/assets/garden.jpg',           alt: 'Lush tropical garden at Ton Mai Spa Rawai' },
  { src: '/assets/steam-room.jpg',       alt: 'Herbal steam room interior' },
  { src: '/assets/pool-day.jpg',         alt: 'Pool and jacuzzi day view' },
  { src: '/assets/massage-2.jpg',        alt: 'Traditional Thai massage treatment' },
  { src: '/assets/sauna.jpg',            alt: 'Finnish sauna wooden interior' },
  { src: '/assets/cold-bath.jpg',        alt: 'Cold plunge pool' },
  { src: '/assets/body-scrub.jpg',       alt: 'Body scrub and wrap treatment' },
  { src: '/assets/garden-2.jpg',         alt: 'Garden lounge area' },
  { src: '/assets/reception.jpg',        alt: 'Ton Mai Spa reception with Tree of Life logo' },
  { src: '/assets/restaurant.jpg',       alt: 'Open-air restaurant beneath the great tree' },
  { src: '/assets/herbal-tea.jpg',       alt: 'Herbal teas and wellness drinks' },
  { src: '/assets/night-ambiance.jpg',   alt: 'Warm night ambiance at the illuminated pool' },
  { src: '/assets/pool-lounge.jpg',      alt: 'Pool lounge with blue sunbeds and palms' },
  { src: '/assets/thai-massage.jpg',     alt: 'Thai massage treatment in bamboo sala' },
]

export default function GallerySection({ gallery = [] }) {
  const photos = gallery.length >= 9
    ? gallery.map(p => ({ src: p.cloudinary_url, alt: p.alt_text ?? 'Ton Mai Spa photo' }))
    : LOCAL_GALLERY

  const [activeIndex, setActiveIndex] = useState(-1)

  return (
    <section id="gallery" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', textAlign: 'center', marginBottom: 'clamp(32px,4vw,52px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>The Garden, by Day &amp; Night</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
            A glimpse of Ton Mai
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'clamp(10px,1.2vw,16px)' }}>
          {photos.map((p, i) => (
            <div key={i} data-reveal
              onClick={() => setActiveIndex(i)}
              style={{ opacity: 0, transform: 'translateY(20px)', transition: `opacity .7s ${Math.min(i,8)*0.07}s ease, transform .7s ${Math.min(i,8)*0.07}s ease`, height: 'clamp(220px,22vw,290px)', overflow: 'hidden', borderRadius: 8, position: 'relative', cursor: 'zoom-in', boxShadow: '0 1px 3px rgba(28,25,23,0.08)' }}
              onMouseEnter={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1.06)'; e.currentTarget.querySelector('.zoom-hint').style.opacity = 1 }}
              onMouseLeave={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1)'; e.currentTarget.querySelector('.zoom-hint').style.opacity = 0 }}>
              <Image src={p.src} alt={p.alt} fill
                sizes="(max-width: 768px) 100vw, 33vw"
                style={{ objectFit: 'cover', transition: 'transform 700ms cubic-bezier(.16,1,.3,1)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="zoom-hint" style={{ color: '#fff', fontSize: 22, opacity: 0, transition: 'opacity 300ms', fontWeight: 300 }}>⊕</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="https://www.instagram.com/tonmaispa" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6 }}
            onClick={() => { if (window.gtag) window.gtag('event','instagram_click',{source:'gallery'}) }}>
            Follow on Instagram →
          </a>
        </div>
      </div>

      <GalleryLightbox
        photos={photos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(-1)}
        onNavigate={setActiveIndex}
      />
    </section>
  )
}
