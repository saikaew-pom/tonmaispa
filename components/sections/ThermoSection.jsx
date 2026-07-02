'use client'

import Image from 'next/image'
import { t } from '@/lib/i18n/t'

export default function ThermoSection({ dict = {} }) {
  const steps = dict.home?.thermo?.steps ?? []

  return (
    <section id="thermal-circuit" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#3B5249', position: 'relative', overflow: 'hidden' }}>
      <Image src="/assets/steam-room.jpg" alt="" aria-hidden="true" fill sizes="100vw"
        style={{ objectFit: 'cover', opacity: 0.12, mixBlendMode: 'luminosity' }} />

      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>
        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', marginBottom: 'clamp(40px,5vw,64px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'home.thermo.eyebrow')}</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#fff', margin: '12px 0 0', maxWidth: '20ch' }}>
            {t(dict, 'home.thermo.title')}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'clamp(24px,3vw,40px)' }}>
          {steps.map((s, i) => (
            <div key={s.title} data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: `opacity .8s ${i*0.12}s ease, transform .8s ${i*0.12}s ease` }}>
              <div style={{ font: '400 48px Cormorant Garamond,serif', color: 'rgba(255,255,255,0.2)', lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ width: 32, height: 1.5, background: '#C4924A', margin: '14px 0' }} />
              <h3 style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff', margin: 0 }}>{s.title}</h3>
              <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.7)', margin: '12px 0 0' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'clamp(40px,5vw,64px)', padding: 'clamp(24px,3vw,36px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '400 clamp(22px,2.5vw,30px) Cormorant Garamond,serif', color: '#fff' }}>{t(dict, 'home.thermo.dayPassTitle')}</div>
            <div style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{t(dict, 'home.thermo.dayPassBody')}</div>
          </div>
          <a href="#contact" style={{ background: '#C4924A', color: '#fff', padding: '14px 28px', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => { if (window.gtag) window.gtag('event','book_now_click',{method:'thermo_section'}) }}>
            {t(dict, 'home.thermo.bookDayPass')}
          </a>
        </div>
      </div>
    </section>
  )
}
