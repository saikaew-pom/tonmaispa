'use client'

import { useState, useEffect } from 'react'
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

const DESKTOP_COLUMNS  = 4
const DESKTOP_PAGE_SIZE = 16 // 4x4
const MOBILE_PAGE_SIZE  = 10 // stacked

export default function GallerySection({ gallery = [] }) {
  // Real photos uploaded via the dashboard always take priority, no matter
  // how few there are. The local placeholder set only shows until the first
  // real upload exists.
  const photos = gallery.length > 0
    ? gallery.map(p => ({ src: p.cloudinary_url, alt: p.alt_text ?? 'Ton Mai Spa photo' }))
    : LOCAL_GALLERY

  const [activeIndex, setActiveIndex] = useState(-1)
  const [isMobile, setIsMobile] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 860)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const pageSize   = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(photos.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const pagePhotos = photos.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const goToPage = (p) => setPage(((p % totalPages) + totalPages) % totalPages)

  return (
    <section id="gallery" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', textAlign: 'center', marginBottom: 'clamp(32px,4vw,52px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>The Garden, by Day &amp; Night</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
            A glimpse of Ton Mai
          </h2>
        </div>

        <div style={{ position: 'relative' }}>
          {/* Sliding page track */}
          <div style={{ overflow: 'hidden', borderRadius: 8 }}>
            <div style={{
              display: 'flex',
              width: `${totalPages * 100}%`,
              transform: `translateX(-${(safePage / totalPages) * 100}%)`,
              transition: 'transform 500ms cubic-bezier(.16,1,.3,1)',
            }}>
              {Array.from({ length: totalPages }, (_, pageIdx) => (
                <div key={pageIdx} style={{ flex: `0 0 ${100 / totalPages}%`, width: `${100 / totalPages}%` }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : `repeat(${DESKTOP_COLUMNS}, 1fr)`,
                    gap: 'clamp(10px,1.2vw,16px)',
                  }}>
                    {photos.slice(pageIdx * pageSize, pageIdx * pageSize + pageSize).map((p, i) => {
                      const globalIndex = pageIdx * pageSize + i
                      return (
                        <div key={p.src + i}
                          onClick={() => setActiveIndex(globalIndex)}
                          style={{ height: 'clamp(220px,22vw,290px)', overflow: 'hidden', borderRadius: 8, position: 'relative', cursor: 'zoom-in', boxShadow: '0 1px 3px rgba(28,25,23,0.08)' }}
                          onMouseEnter={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1.06)'; e.currentTarget.querySelector('.zoom-hint').style.opacity = 1 }}
                          onMouseLeave={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1)'; e.currentTarget.querySelector('.zoom-hint').style.opacity = 0 }}>
                          <Image src={p.src} alt={p.alt} fill
                            sizes={isMobile ? '100vw' : '25vw'}
                            style={{ objectFit: 'cover', transition: 'transform 700ms cubic-bezier(.16,1,.3,1)' }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="zoom-hint" style={{ color: '#fff', fontSize: 22, opacity: 0, transition: 'opacity 300ms', fontWeight: 300 }}>⊕</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slide controls — only shown when there's more than one page */}
          {totalPages > 1 && (
            <>
              <button onClick={() => goToPage(safePage - 1)} aria-label="Previous photos" style={{ ...arrowStyle, left: -18 }}>←</button>
              <button onClick={() => goToPage(safePage + 1)} aria-label="Next photos" style={{ ...arrowStyle, right: -18 }}>→</button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <span key={i} onClick={() => goToPage(i)} role="button" aria-label={`Go to photo page ${i + 1}`}
                    style={{
                      display: 'block', height: 8, width: i === safePage ? 24 : 8, borderRadius: 999, cursor: 'pointer',
                      background: i === safePage ? '#3B5249' : '#D9D2C7', transition: 'width .3s, background .3s',
                    }} />
                ))}
              </div>
            </>
          )}
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

const arrowStyle = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  width: 44, height: 44, borderRadius: '50%',
  background: '#fff', border: '1px solid #E0D9D0', boxShadow: '0 4px 16px rgba(28,25,23,0.12)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#3B5249', fontSize: 16, zIndex: 2,
}
