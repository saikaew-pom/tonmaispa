'use client'

import Image from 'next/image'
import { t } from '@/lib/i18n/t'

const IMAGES = ['/assets/steam-room.jpg', '/assets/sauna.jpg', '/assets/cold-bath.jpg', '/assets/pool-day.jpg', '/assets/garden-2.jpg', '/assets/restaurant.jpg']

export default function FacilitiesSection({ dict = {} }) {
  const items = (dict.home?.facilities?.items ?? []).map((item, i) => ({ ...item, img: IMAGES[i] }))

  return (
    <section id="facilities" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', marginBottom: 'clamp(40px,5vw,64px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, alignItems: 'end' }}>
          <div>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'home.facilities.eyebrow')}</div>
            <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
              {t(dict, 'home.facilities.title')}
            </h2>
          </div>
          <p style={{ font: '400 clamp(14px,1.1vw,16px)/1.7 Inter,sans-serif', color: '#6B6663', margin: 0 }}>
            {t(dict, 'home.facilities.subtitle')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
          {items.map((f, i) => (
            <div key={f.title} data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: `opacity .8s ${i*0.08}s ease, transform .8s ${i*0.08}s ease`, position: 'relative', height: 280, borderRadius: 8, overflow: 'hidden', cursor: 'default' }}
              onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = 1}
              onMouseLeave={e => e.currentTarget.querySelector('.overlay').style.opacity = 0}>
              <Image src={f.img} alt={f.title} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
              <div className="overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(59,82,73,0.05) 0%,rgba(59,82,73,0.92) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 22px', opacity: 0.85, transition: 'opacity 300ms ease' }}>
                <h3 style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff', margin: 0 }}>{f.title}</h3>
                <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: 'rgba(255,255,255,0.85)', margin: '8px 0 0' }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
