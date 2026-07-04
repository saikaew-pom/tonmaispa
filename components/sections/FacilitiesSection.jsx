'use client'

import Image from 'next/image'

const DEFAULT_EYEBROW    = 'Facilities'
const DEFAULT_HEADING    = 'Everything in one garden.'
const DEFAULT_SUBHEADING = 'No need to rush between buildings. Steam, sauna, cold plunge, pool, restaurant, and massage salas are all connected by shaded garden paths — so you flow from one to the next at your own pace.'

// Shown only if the facilities table is empty (e.g. right after the
// migration, before any real photos are uploaded) — matches the same
// never-blank-homepage principle as TreatmentsSection's placeholders.
const PLACEHOLDERS = [
  { title: 'Herbal Steam Room', body: 'Private rooms infused with lemongrass, kaffir lime and eucalyptus.', img: '/assets/steam-room.jpg' },
  { title: 'Finnish Sauna', body: 'Dry heat in a traditional wooden cabin — up to 95°C.', img: '/assets/sauna.jpg' },
  { title: 'Cold Plunge Pool', body: 'Crisp 10–15°C immersion to seal the circuit and invigorate the body.', img: '/assets/cold-bath.jpg' },
]

export default function FacilitiesSection({ facilities = [], settings = {} }) {
  const eyebrow    = settings['settings.homepage_facilities_eyebrow']    || DEFAULT_EYEBROW
  const heading    = settings['settings.homepage_facilities_heading']    || DEFAULT_HEADING
  const subheading = settings['settings.homepage_facilities_subheading'] || DEFAULT_SUBHEADING

  const items = facilities.length > 0
    ? facilities.map(f => ({ title: f.title, body: f.body, img: f.image_url }))
    : PLACEHOLDERS

  return (
    <section id="facilities" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', marginBottom: 'clamp(40px,5vw,64px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, alignItems: 'end' }}>
          <div>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{eyebrow}</div>
            <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
              {heading}
            </h2>
          </div>
          <p style={{ font: '400 clamp(14px,1.1vw,16px)/1.7 Inter,sans-serif', color: '#6B6663', margin: 0 }}>
            {subheading}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
          {items.map((f, i) => (
            <div key={f.img + i} data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: `opacity .8s ${i*0.08}s ease, transform .8s ${i*0.08}s ease`, position: 'relative', height: 280, borderRadius: 8, overflow: 'hidden', cursor: 'default' }}
              onMouseEnter={e => { const el = e.currentTarget.querySelector('.overlay'); if (el) el.style.opacity = 1 }}
              onMouseLeave={e => { const el = e.currentTarget.querySelector('.overlay'); if (el) el.style.opacity = 0.85 }}>
              <Image src={f.img} alt={f.title ?? ''} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
              {f.title && (
                <div className="overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(59,82,73,0.05) 0%,rgba(59,82,73,0.92) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 22px', opacity: 0.85, transition: 'opacity 300ms ease' }}>
                  <h3 style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff', margin: 0 }}>{f.title}</h3>
                  {f.body && <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: 'rgba(255,255,255,0.85)', margin: '8px 0 0' }}>{f.body}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
