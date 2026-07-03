'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { t } from '@/lib/i18n/t'
import LanguageSwitcher from './LanguageSwitcher'

export default function Nav({ lang = 'en', dict = {} }) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [scrolled, setScrolled]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const close = () => setMenuOpen(false)

  // privacy/terms haven't moved under /[lang]/ yet (later phase), so those
  // stay unprefixed and English-only for now.
  return (
    <>
      {/* ── Fixed header ─────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? 'rgba(250,246,240,0.92)' : 'rgba(250,246,240,0.82)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(224,217,208,0.7)',
        transition: 'background 300ms ease',
      }}>
        <nav style={{
          maxWidth: 1200, margin: '0 auto', height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(18px,4vw,40px)',
        }}>
          <a href={`/${lang}#top`} aria-label="Ton Mai Spa home">
            <Image src="/logo-white.png" alt="Ton Mai Spa" width={180} height={60} priority style={{ height: 46, width: 'auto', filter: 'brightness(0)' }} />
          </a>

          {/* Desktop links — hidden on small screens via CSS */}
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,28px)' }}>
            {[
              [`/${lang}/spa-menu`,   t(dict, 'nav.treatments')],
              [`/${lang}/restaurant`, t(dict, 'nav.restaurant')],
              [`/${lang}#facilities`, t(dict, 'nav.facilities')],
              [`/${lang}#pricing`,    t(dict, 'nav.pricing')],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ font: '500 12px Inter,sans-serif', letterSpacing: '0.5px', color: '#1C1917' }}>{label}</a>
            ))}
            <LanguageSwitcher lang={lang} dict={dict} />
            <Link href="/login" style={{ font: '500 12px Inter,sans-serif', letterSpacing: '0.5px', color: '#1C1917', opacity: 0.75 }}>{t(dict, 'nav.login')}</Link>
            <Link href={`/${lang}/book`} onClick={() => { if (window.gtag) window.gtag('event','book_now_click',{method:'nav'}) }} style={{
              background: '#3B5249', color: '#fff',
              padding: '11px 22px', borderRadius: 2,
              font: '600 11px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase',
            }}>{t(dict, 'nav.bookNow')}</Link>
          </div>

          {/* Burger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 30, padding: '6px 3px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ height: 1.5, background: '#1C1917', display: 'block', width: i === 2 ? '70%' : '100%', transition: 'opacity 150ms' }} />
            ))}
          </button>
        </nav>
      </header>

      {/* ── Full-screen overlay menu ─────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#3B5249',
        display: 'flex', flexDirection: 'column',
        opacity: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? 'auto' : 'none',
        transition: 'opacity 300ms ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '22px clamp(18px,4vw,40px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Image src="/logo-white.png" alt="Ton Mai Spa" width={180} height={60} style={{ height: 52, width: 'auto', opacity: 0.92 }} />
          <button onClick={close} aria-label="Close menu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FAF6F0', font: '300 32px Inter,sans-serif', lineHeight: 1 }}>×</button>
        </div>

        <nav style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: 'clamp(20px,5vw,56px) clamp(18px,4vw,40px)', display: 'flex', flexDirection: 'column', gap: 'clamp(8px,2vw,18px)', flex: 1 }}>
          {[
            [`/${lang}#about`,      t(dict, 'nav.ourGarden')],
            [`/${lang}/spa-menu`,   t(dict, 'nav.treatments')],
            [`/${lang}/restaurant`, t(dict, 'nav.restaurant')],
            [`/${lang}#facilities`, t(dict, 'nav.facilities')],
            [`/${lang}#pricing`,    t(dict, 'nav.pricing')],
            [`/${lang}/book`,       t(dict, 'nav.bookNow')],
          ].map(([href, label], i) => (
            <a key={href} href={href} onClick={() => { close(); if (i === 5 && window.gtag) window.gtag('event','book_now_click',{method:'mobile_menu'}) }} style={{
              font: `400 clamp(34px,7vw,60px) Cormorant Garamond,serif`,
              color: i === 5 ? '#D9AE72' : '#FAF6F0',
              borderBottom: i < 5 ? '1px solid rgba(250,246,240,0.14)' : 'none',
              paddingBottom: i < 5 ? 'clamp(8px,2vw,18px)' : 0,
            }}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '0 clamp(18px,4vw,40px) 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(250,246,240,0.5)' }}>{t(dict, 'nav.openHours')}</div>
            <div style={{ font: '400 15px Inter,sans-serif', color: 'rgba(250,246,240,0.85)', marginTop: 8 }}>+66 63 117 5211 · Rawai, Phuket</div>
          </div>
          <Link href="/login" onClick={close} style={{ font: '500 12px Inter,sans-serif', color: 'rgba(250,246,240,0.55)', textDecoration: 'underline' }}>{t(dict, 'nav.login')}</Link>
        </div>
      </div>

      <style>{`
        @media (min-width: 860px) {
          .nav-links { display: flex !important; }
        }
        @media (max-width: 859px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </>
  )
}
