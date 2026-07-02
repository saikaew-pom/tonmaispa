import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import LegalContent from '@/components/ui/LegalContent'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'
import { t } from '@/lib/i18n/t'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export function generateMetadata({ params }) {
  return {
    title:       'Privacy Policy — Ton Mai Spa',
    description: 'How Ton Mai Spa collects and uses your personal information, in line with Thailand’s PDPA and the GDPR.',
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/privacy`]),
        ['x-default', `${SITE_URL}/en/privacy`],
      ]),
    },
  }
}

export function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }))
}

export default async function PrivacyPage({ params }) {
  const { lang } = await params
  const dict = await getDictionary(lang)
  const blocks = dict.privacyPage?.blocks ?? []

  return (
    <>
      <Nav lang={lang} dict={dict} />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'legal.legal')}</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>{t(dict, 'privacyPage.title')}</h1>
          <p style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>{t(dict, 'legal.lastUpdated')}</p>
        </div>
      </section>

      <main style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <LegalContent blocks={blocks} />
        </div>
      </main>

      <Footer lang={lang} dict={dict} />
    </>
  )
}
