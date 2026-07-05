import Image from 'next/image'
import Link from 'next/link'
import TrackedLink from '@/components/ui/TrackedLink'
import CookieSettingsLink from '@/components/ui/CookieSettingsLink'
import { t } from '@/lib/i18n/t'

export default function Footer({ settings = {}, lang = 'en', dict = {} }) {
  const wa   = settings['settings.whatsapp_number'] ?? '66631175211'
  const line = settings['settings.line_id']         ?? '@tonmaispa'
  const ig   = settings['settings.instagram_url']   ?? 'https://www.instagram.com/tonmai.spa/'
  const fb   = settings['settings.facebook_url']    ?? 'https://www.facebook.com/tonmai.spa'

  const exploreLinks = [
    [`/${lang}/spa-menu`,   t(dict, 'footer.spaMenu')],
    [`/${lang}/restaurant`, t(dict, 'footer.restaurant')],
    [`/${lang}/blog`,       t(dict, 'footer.blog')],
    [`/${lang}/book`,       t(dict, 'footer.bookNow')],
    [`/${lang}#facilities`, t(dict, 'footer.facilities')],
    [`/${lang}#pricing`,    t(dict, 'footer.pricing')],
  ]

  return (
    <footer style={{ background: '#1C1917', color: 'rgba(250,246,240,0.72)', padding: 'clamp(48px,6vw,80px) clamp(18px,4vw,40px) 36px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'clamp(28px,4vw,56px)' }}>

        <div>
          <Image src="/logo-white.png" alt="Ton Mai Spa" width={200} height={68} style={{ height: 68, width: 'auto', opacity: 0.9 }} />
          <p style={{ font: '400 13px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.55)', margin: '18px 0 0', maxWidth: '34ch' }}>
            {t(dict, 'footer.tagline')}
          </p>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>{t(dict, 'footer.explore')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
            {exploreLinks.map(([h,l]) => (
              <a key={h} href={h} style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{l}</a>
            ))}
          </div>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>{t(dict, 'footer.visit')}</div>
          <div style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.72)', marginTop: 18 }}>
            6/11 Moo 2 Wiset Road,<br />Tambon Rawai, Phuket 83130<br />Thailand
          </div>
          <div style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.72)', marginTop: 14 }}>
            {t(dict, 'nav.openHours')}<br />+66 63 117 5211
          </div>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>{t(dict, 'footer.connect')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
            <TrackedLink href={ig} event="instagram_click" params={{ source: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{t(dict, 'footer.instagram')}</TrackedLink>
            <TrackedLink href={fb} event="facebook_click" params={{ source: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{t(dict, 'footer.facebook')}</TrackedLink>
            <TrackedLink href={`https://wa.me/${wa}`} event="whatsapp_click" params={{ method: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{t(dict, 'footer.whatsapp')}</TrackedLink>
            <TrackedLink href={`https://line.me/R/ti/p/${line}`} event="line_click" params={{ method: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{t(dict, 'footer.line')}</TrackedLink>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: 'clamp(36px,5vw,56px) auto 0', paddingTop: 26, borderTop: '1px solid rgba(250,246,240,0.12)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', font: '400 12px Inter,sans-serif', color: 'rgba(250,246,240,0.45)' }}>
        <span>© {new Date().getFullYear()} Ton Mai Spa · Rawai, Phuket</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <Link href={`/${lang}/privacy`} style={{ color: 'rgba(250,246,240,0.45)' }}>{t(dict, 'footer.privacy')}</Link>
          <Link href={`/${lang}/terms`}   style={{ color: 'rgba(250,246,240,0.45)' }}>{t(dict, 'footer.terms')}</Link>
          <CookieSettingsLink style={{ color: 'rgba(250,246,240,0.45)' }} />
        </span>
      </div>
    </footer>
  )
}
