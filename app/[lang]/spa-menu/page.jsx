import Link                  from 'next/link'
import Nav                   from '@/components/layout/Nav'
import Footer                from '@/components/layout/Footer'
import TrackedLink           from '@/components/ui/TrackedLink'
import TreatmentPhotosButton from '@/components/ui/TreatmentPhotosButton'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { TREATMENT_CATEGORIES } from '@/lib/display'
import { translateRows } from '@/lib/translate'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'
import { t } from '@/lib/i18n/t'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export function generateMetadata({ params }) {
  return {
    title:       'Spa Menu — Treatments & Pricing | Ton Mai Spa Rawai Phuket',
    description: 'Full spa menu: Thai massage, aromatherapy, deep tissue, facials, body treatments and thermal circuit. Open daily 09:00–23:00 in Rawai, Phuket.',
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/spa-menu`]),
        ['x-default', `${SITE_URL}/en/spa-menu`],
      ]),
    },
    openGraph: {
      title:       'Spa Menu — Ton Mai Spa',
      description: 'All treatments and pricing at Ton Mai Spa, Rawai Phuket.',
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  }
}

const CATEGORY_LABELS = TREATMENT_CATEGORIES

async function getData(lang) {
  const admin = createSupabaseAdminClient()
  const [txRes, stRes] = await Promise.all([
    admin.from('spa_treatments').select('id,name,slug,description,category,duration_options,prices,badge,photos').eq('is_active', true).order('sort_order'),
    admin.from('site_content').select('key,value_text').eq('page', 'settings'),
  ])
  const settings = Object.fromEntries((stRes.data ?? []).map(r => [r.key, r.value_text]))

  let treatments = txRes.data ?? []
  if (lang !== 'en') {
    treatments = await translateRows('spa_treatments', treatments, ['name', 'description', 'badge'], lang)
  }

  const grouped = {}
  treatments.forEach(tr => { (grouped[tr.category] ??= []).push(tr) })
  return { grouped, settings }
}

export default async function SpaMenuPage({ params }) {
  const { lang } = await params
  const [{ grouped, settings }, dict] = await Promise.all([getData(lang), getDictionary(lang)])
  const categories = Object.keys(grouped)
  const wa   = settings['settings.whatsapp_number'] ?? '66822866058'
  const waMsg = encodeURIComponent("Hi, I'd like to book a treatment at Ton Mai Spa")

  return (
    <>
      <Nav lang={lang} dict={dict} />

      {/* Page hero */}
      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'spaMenu.tonMaiSpa')}</div>
          <h1 style={{ font: '400 clamp(38px,7vw,72px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>
            {t(dict, 'spaMenu.ourTreatments')}
          </h1>
          <p style={{ font: '400 clamp(14px,1.2vw,17px)/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.8)', margin: '16px 0 0', maxWidth: '52ch' }}>
            {t(dict, 'spaMenu.heroText')}
          </p>
          {/* Horizontal category nav */}
          <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <a key={cat} href={`#${cat}`} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}>
                {CATEGORY_LABELS[cat] ?? cat}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Thermal circuit callout */}
      <div style={{ background: '#1C1917', padding: '20px clamp(18px,4vw,40px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ font: '400 clamp(14px,1.2vw,17px) Cormorant Garamond,serif', color: '#fff' }}>
            {t(dict, 'spaMenu.dayPassLabel')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ font: '400 26px Cormorant Garamond,serif', color: '#C4924A' }}>฿200 <span style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.5)' }}>{t(dict, 'spaMenu.perPerson')}</span></div>
            <TrackedLink href={`/${lang}/book`} event="book_now_click" params={{ method: 'spa_menu_day_pass' }} style={{ background: '#C4924A', color: '#fff', padding: '10px 20px', borderRadius: 2, font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>{t(dict, 'spaMenu.book')}</TrackedLink>
          </div>
        </div>
      </div>

      {/* Treatment categories */}
      <main style={{ background: '#FAF6F0' }}>
        {categories.map((cat, ci) => (
          <section key={cat} id={cat} style={{ padding: 'clamp(56px,7vw,96px) clamp(18px,4vw,40px)', borderBottom: ci < categories.length - 1 ? '1px solid #E5E0D8' : 'none', scrollMarginTop: 80 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ marginBottom: 'clamp(28px,3vw,44px)' }}>
                <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                <div style={{ width: 36, height: 2, background: '#3B5249', marginTop: 12 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 'clamp(16px,2vw,28px)' }}>
                {grouped[cat].map(tr => {
                  const durations = tr.duration_options ?? []
                  const prices    = tr.prices ?? {}
                  return (
                    <div key={tr.id} style={{ background: '#fff', borderRadius: 6, padding: 'clamp(20px,2.5vw,32px)', boxShadow: '0 2px 12px rgba(28,25,23,0.06)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <h2 style={{ font: '400 clamp(18px,1.8vw,22px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>
                            <Link href={`/${lang}/spa-menu/${tr.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tr.name}</Link>
                          </h2>
                          {tr.badge && (
                            <span style={{ flexShrink: 0, background: '#C4924A', color: '#fff', padding: '3px 10px', borderRadius: 999, font: '600 9px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr.badge}</span>
                          )}
                        </div>
                        {tr.description && (
                          <p style={{ font: '400 13px/1.65 Inter,sans-serif', color: '#6B6663', margin: '10px 0 0' }}>{tr.description}</p>
                        )}
                        {tr.photos?.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <TreatmentPhotosButton photos={tr.photos} treatmentName={tr.name} />
                          </div>
                        )}
                      </div>

                      {/* Price table */}
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #F0ECE6' }}>
                        {durations.map(dur => (
                          <div key={dur} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                            <span style={{ font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{dur} {t(dict, 'spaMenu.min')}</span>
                            <span style={{ font: '600 15px Cormorant Garamond,serif', color: '#1C1917' }}>฿{prices[String(dur)]?.toLocaleString() ?? '—'}</span>
                          </div>
                        ))}
                        <TrackedLink href={`/${lang}/book?treatment=${tr.slug}`} event="book_now_click" params={{ method: 'spa_menu_treatment_card', treatment: tr.name }} style={{ display: 'block', marginTop: 14, background: '#3B5249', color: '#fff', padding: '10px 0', borderRadius: 2, font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', textDecoration: 'none' }}>
                          {t(dict, 'spaMenu.bookThisTreatment')}
                        </TrackedLink>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ))}

        {/* Bottom CTA */}
        <section style={{ padding: 'clamp(48px,6vw,80px) clamp(18px,4vw,40px)', background: '#E8EDE9', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'spaMenu.questions')}</div>
            <h2 style={{ font: '400 clamp(26px,4vw,42px)/1.1 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
              {t(dict, 'spaMenu.helpChoose')}
            </h2>
            <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663', marginTop: 12 }}>
              {t(dict, 'spaMenu.helpChooseText')}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              <TrackedLink href={`https://wa.me/${wa}?text=${waMsg}`} event="whatsapp_click" params={{ method: 'spa_menu_bottom' }} target="_blank" rel="noopener noreferrer"
                style={{ background: '#25D366', color: '#fff', padding: '14px 26px', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'none' }}>
                {t(dict, 'spaMenu.whatsappUs')}
              </TrackedLink>
              <TrackedLink href={`/${lang}/book`} event="book_now_click" params={{ method: 'spa_menu_bottom' }}
                style={{ background: '#3B5249', color: '#fff', padding: '14px 26px', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'none' }}>
                {t(dict, 'spaMenu.bookOnline')}
              </TrackedLink>
            </div>
          </div>
        </section>
      </main>

      <Footer settings={settings} lang={lang} dict={dict} />
    </>
  )
}
