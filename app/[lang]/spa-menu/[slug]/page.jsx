import Link         from 'next/link'
import { notFound } from 'next/navigation'
import Nav          from '@/components/layout/Nav'
import Footer        from '@/components/layout/Footer'
import TrackedLink    from '@/components/ui/TrackedLink'
import TreatmentGallery from './TreatmentGallery'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { TREATMENT_CATEGORIES } from '@/lib/display'
import { jsonLdScript, breadcrumbSchema } from '@/lib/json-ld'
import { translateFields } from '@/lib/translate'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'
import { t } from '@/lib/i18n/t'

export const revalidate = 60
// New treatments get their own page on first visit even without a
// redeploy — this is what makes indexing "automatic" as staff add them.
export const dynamicParams = true

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

async function getTreatment(slug, lang) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('spa_treatments')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null
  if (lang === 'en') return data

  const translated = await translateFields('spa_treatments', data.id, {
    name: data.name, description: data.description, badge: data.badge,
  }, lang)
  return { ...data, ...translated }
}

// Pre-render every currently-active treatment, for every locale, at
// build/deploy time; anything added afterwards still renders on-demand
// thanks to dynamicParams above.
export async function generateStaticParams() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('spa_treatments').select('slug').eq('is_active', true)
  return LOCALES.flatMap(lang => (data ?? []).map(tr => ({ lang, slug: tr.slug })))
}

export async function generateMetadata({ params }) {
  const { slug, lang } = await params
  const treatment = await getTreatment(slug, lang)
  if (!treatment) return { title: 'Treatment Not Found — Ton Mai Spa' }

  const categoryLabel = TREATMENT_CATEGORIES[treatment.category] ?? treatment.category
  const title = `${treatment.name} — ${categoryLabel} | Ton Mai Spa Rawai Phuket`
  const description = treatment.description
    ? `${treatment.description} Book ${treatment.name} at Ton Mai Spa, Rawai, Phuket.`
    : `${treatment.name} — ${categoryLabel} at Ton Mai Spa, a traditional Thai spa in Rawai, Phuket. Open daily 09:00–23:00.`
  const ogImage = treatment.photos?.[0] ?? `${SITE_URL}/og-image.jpg`

  return {
    title,
    description,
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/spa-menu/${slug}`]),
        ['x-default', `${SITE_URL}/en/spa-menu/${slug}`],
      ]),
    },
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  }
}

export default async function TreatmentDetailPage({ params }) {
  const { slug, lang } = await params
  const [treatment, dict] = await Promise.all([getTreatment(slug, lang), getDictionary(lang)])
  if (!treatment) notFound()

  const categoryLabel = TREATMENT_CATEGORIES[treatment.category] ?? treatment.category
  const durations = treatment.duration_options ?? []
  const prices    = treatment.prices ?? {}
  const lowestPrice = durations.length ? Math.min(...durations.map(d => prices[String(d)]).filter(Boolean)) : null

  const schema = jsonLdScript({
    '@context': 'https://schema.org',
    '@type':    'Service',
    serviceType: treatment.name,
    name:        treatment.name,
    description: treatment.description ?? `${treatment.name} at Ton Mai Spa, Rawai, Phuket`,
    provider: {
      '@type': 'DaySpa',
      name:    'Ton Mai Spa',
      url:     SITE_URL,
      address: {
        '@type':         'PostalAddress',
        streetAddress:   '6/11 Moo 2 Wiset Road',
        addressLocality: 'Rawai',
        addressRegion:   'Phuket',
        postalCode:      '83130',
        addressCountry:  'TH',
      },
    },
    areaServed: 'Rawai, Phuket, Thailand',
    ...(treatment.photos?.length ? { image: treatment.photos } : {}),
    ...(lowestPrice ? {
      offers: durations.map(d => ({
        '@type':         'Offer',
        priceCurrency:   'THB',
        price:            prices[String(d)] ?? undefined,
        description:      `${d} minutes`,
      })),
    } : {}),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema([
        { name: 'Ton Mai Spa', url: `${SITE_URL}/${lang}` },
        { name: 'Spa Menu', url: `${SITE_URL}/${lang}/spa-menu` },
        { name: treatment.name },
      ])) }} />
      <Nav lang={lang} dict={dict} />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '400 12px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            <Link href={`/${lang}/spa-menu`} style={{ color: 'rgba(255,255,255,0.6)' }}>{t(dict, 'nav.treatments')}</Link> / {categoryLabel}
          </div>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{categoryLabel}</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>
            {treatment.name}
            {treatment.badge && (
              <span style={{ display: 'inline-block', marginLeft: 14, verticalAlign: 'middle', background: '#C4924A', color: '#fff', padding: '5px 14px', borderRadius: 999, font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>{treatment.badge}</span>
            )}
          </h1>
          {treatment.description && (
            <p style={{ font: '400 clamp(14px,1.2vw,17px)/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.8)', margin: '16px 0 0', maxWidth: '60ch' }}>{treatment.description}</p>
          )}
        </div>
      </section>

      <main style={{ background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(18px,4vw,40px)' }}>

          {treatment.photos?.length > 0 && (
            <div style={{ marginBottom: 'clamp(32px,4vw,48px)' }}>
              <TreatmentGallery photos={treatment.photos} treatmentName={treatment.name} />
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 8, padding: 'clamp(24px,3vw,36px)', boxShadow: '0 2px 12px rgba(28,25,23,0.06)' }}>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#9B9390', marginBottom: 16 }}>{t(dict, 'spaMenu.durationPricing')}</div>
            {durations.length > 0 ? durations.map(d => (
              <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F0ECE6' }}>
                <span style={{ font: '400 16px Inter,sans-serif', color: '#1C1917' }}>{d} {t(dict, 'spaMenu.minutes')}</span>
                <span style={{ font: '600 22px Cormorant Garamond,serif', color: '#3B5249' }}>฿{prices[String(d)]?.toLocaleString() ?? '—'}</span>
              </div>
            )) : (
              <p style={{ font: '400 14px Inter,sans-serif', color: '#6B6663' }}>{t(dict, 'spaMenu.contactForPricing')}</p>
            )}
            <TrackedLink href={`/${lang}/book?treatment=${treatment.slug}`} event="book_now_click" params={{ method: 'treatment_detail', treatment: treatment.name }} style={{ display: 'block', marginTop: 20, background: '#3B5249', color: '#fff', padding: '14px 0', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', textDecoration: 'none' }}>
              {t(dict, 'spaMenu.bookThisTreatment')}
            </TrackedLink>
          </div>

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Link href={`/${lang}/spa-menu#${treatment.category}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6, textDecoration: 'none' }}>
              ← {t(dict, 'spaMenu.backTo')} {categoryLabel}
            </Link>
          </div>
        </div>
      </main>

      <Footer lang={lang} dict={dict} />
    </>
  )
}
