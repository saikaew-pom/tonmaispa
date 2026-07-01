'use client'

import Image from 'next/image'

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
]

export default function GallerySection({ gallery = [] }) {
  const photos = gallery.length >= 9
    ? gallery.map(p => ({ src: p.cloudinary_url, alt: p.alt_text ?? 'Ton Mai Spa photo' }))
    : LOCAL_GALLERY

  return (
    <section id="gallery" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', textAlign: 'center', marginBottom: 'clamp(32px,4vw,52px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Gallery</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
            Life at Ton Mai Spa
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {photos.map((p, i) => (
            <div key={i} data-reveal style={{ opacity: 0, transform: 'translateY(20px)', transition: `opacity .7s ${i*0.07}s ease, transform .7s ${i*0.07}s ease`, aspectRatio: i === 0 ? '2/1.2' : '1/1', gridColumn: i === 0 ? '1/-1' : undefined, overflow: 'hidden', borderRadius: 6, position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1.04)' }}
              onMouseLeave={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1)' }}>
              <Image src={p.src} alt={p.alt} fill
                sizes={i === 0 ? '100vw' : '(max-width: 768px) 100vw, 33vw'}
                style={{ objectFit: 'cover', transition: 'transform 600ms cubic-bezier(.16,1,.3,1)' }} />
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
    </section>
  )
}
