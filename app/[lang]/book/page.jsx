import Nav         from '@/components/layout/Nav'
import Footer      from '@/components/layout/Footer'
import BookingCTA  from '@/components/ui/BookingCTA'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'
import { t } from '@/lib/i18n/t'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export function generateMetadata({ params }) {
  return {
    title:       'Book Your Treatment — Ton Mai Spa | Rawai Phuket',
    description: 'Book a massage, facial or day pass at Ton Mai Spa in Rawai, Phuket. Online booking, WhatsApp or Line — we reply within minutes.',
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/book`]),
        ['x-default', `${SITE_URL}/en/book`],
      ]),
    },
    openGraph: {
      title:       'Book — Ton Mai Spa',
      description: 'Reserve your treatment or sauna day pass at Ton Mai Spa, Rawai Phuket.',
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  }
}

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('site_content').select('key,value_text').eq('page', 'settings')
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value_text]))
}

export default async function BookPage({ params, searchParams }) {
  const { lang } = await params
  const { treatment: presetSlug } = await searchParams
  const [settings, dict] = await Promise.all([getData(), getDictionary(lang)])
  const faq = dict.book?.faq ?? []
  const dayPassItems = dict.book?.dayPassItems ?? []

  return (
    <>
      <Nav lang={lang} dict={dict} />

      {/* Page header */}
      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'book.tagline')}</div>
          <h1 style={{ font: '400 clamp(36px,7vw,68px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>
            {t(dict, 'book.reserveYourTime')}
          </h1>
          <p style={{ font: '400 clamp(14px,1.2vw,17px)/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.8)', margin: '16px 0 0', maxWidth: '46ch', marginLeft: 'auto', marginRight: 'auto' }}>
            {t(dict, 'book.heroText')}
          </p>
        </div>
      </section>

      <main style={{ background: '#FAF6F0' }}>

        {/* Booking form section */}
        <section style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <BookingCTA settings={settings} dict={dict} presetSlug={presetSlug} />
          </div>
        </section>

        {/* Sauna day pass callout */}
        <section style={{ padding: 'clamp(40px,5vw,64px) clamp(18px,4vw,40px)', background: '#1C1917' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(28px,4vw,52px)', alignItems: 'center' }}>
            <div>
              <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'book.noTreatmentNeeded')}</div>
              <h2 style={{ font: '400 clamp(26px,3.5vw,40px)/1.1 Cormorant Garamond,serif', color: '#fff', margin: '12px 0 0' }}>{t(dict, 'book.dayGardenHeading')}</h2>
              <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>{t(dict, 'book.dayGardenText')}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: 'clamp(22px,2.5vw,32px)', textAlign: 'center' }}>
              <div style={{ font: '400 64px/1 Cormorant Garamond,serif', color: '#fff' }}>฿200</div>
              <div style={{ font: '400 15px Inter,sans-serif', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{t(dict, 'book.perPersonAllDay')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, textAlign: 'left' }}>
                {dayPassItems.map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, font: '400 13px Inter,sans-serif', color: 'rgba(255,255,255,0.75)' }}>
                    <span style={{ color: '#C4924A' }}>✓</span>{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: 'clamp(56px,7vw,96px) clamp(18px,4vw,40px)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A', marginBottom: 16 }}>{t(dict, 'book.faqLabel')}</div>
            <h2 style={{ font: '400 clamp(26px,4vw,42px)/1.1 Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 36px' }}>
              {t(dict, 'book.faqHeading')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {faq.map((item, i) => (
                <div key={i} style={{ padding: 'clamp(18px,2vw,26px) 0', borderBottom: i < faq.length - 1 ? '1px solid #E5E0D8' : 'none' }}>
                  <div style={{ font: '600 15px/1.4 Inter,sans-serif', color: '#1C1917', marginBottom: 8 }}>{item.q}</div>
                  <div style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663' }}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer settings={settings} lang={lang} dict={dict} />
    </>
  )
}
