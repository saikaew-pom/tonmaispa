// ============================================================
// TON MAI SPA — Homepage
// ISR 60s · All content from Supabase site_content + spa_treatments
// Localized via /[lang] — English content translated on-demand via
// MiniMax and cached in content_translations (see lib/translate.js)
// ============================================================

import Nav                       from '@/components/layout/Nav'
import Footer                    from '@/components/layout/Footer'
import HeroSection               from '@/components/sections/HeroSection'
import AboutSection              from '@/components/sections/AboutSection'
import TreatmentsSection         from '@/components/sections/TreatmentsSection'
import ThermoSection             from '@/components/sections/ThermoSection'
import FacilitiesSection         from '@/components/sections/FacilitiesSection'
import PricingSection            from '@/components/sections/PricingSection'
import GallerySection            from '@/components/sections/GallerySection'
import ReviewsSection            from '@/components/sections/ReviewsSection'
import ContactSection            from '@/components/sections/ContactSection'
import StickyBookingBar          from '@/components/layout/StickyBookingBar'
import ScrollReveal              from '@/components/ui/ScrollReveal'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { jsonLdScript, spaSchema }   from '@/lib/json-ld'
import { translateRows, translateFields } from '@/lib/translate'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export function generateMetadata({ params }) {
  return {
    title:       'Ton Mai Spa — Garden Spa in Rawai, Phuket',
    description: 'Traditional Thai spa in Rawai, Phuket. Thermal circuit, massage, facials, garden lounge. 5 minutes from Nai Harn Beach. Open daily 09:00–23:00.',
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}`]),
        ['x-default', `${SITE_URL}/en`],
      ]),
    },
    openGraph: {
      title:       'Ton Mai Spa — Garden Spa in Rawai, Phuket',
      description: 'Traditional Thai spa in Rawai, Phuket. Steam, sauna, cold plunge, pool & massage in a lush tropical garden. Open daily until 11pm.',
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  }
}

async function getData(lang) {
  const admin = createSupabaseAdminClient()

  const [treatmentsRes, settingsRes, galleryRes] = await Promise.all([
    admin.from('spa_treatments')
      .select('id, name, slug, description, category, duration_options, prices, badge, photos')
      .eq('is_active', true)
      .eq('show_on_homepage', true)
      .order('sort_order')
      .limit(9),

    admin.from('site_content')
      .select('key, value_text')
      .eq('page', 'settings'),

    admin.from('gallery_photos')
      .select('id, cloudinary_url, alt_text, category')
      .eq('featured', true)
      .order('sort_order')
      .limit(48),
  ])

  let settings = Object.fromEntries(
    (settingsRes.data ?? []).map(r => [r.key, r.value_text])
  )
  let treatments = treatmentsRes.data ?? []
  let gallery    = galleryRes.data ?? []

  if (lang !== 'en') {
    treatments = await translateRows('spa_treatments', treatments, ['name', 'description', 'badge'], lang)

    // Only the homepage settings copy (headings/subheadings) is worth
    // translating — numeric/URL settings pass through untouched.
    const TRANSLATABLE_SETTING_KEYS = [
      'settings.homepage_services_heading',
      'settings.homepage_services_subheading',
    ]
    const settingFields = Object.fromEntries(
      TRANSLATABLE_SETTING_KEYS.filter(k => settings[k]).map(k => [k, settings[k]])
    )
    if (Object.keys(settingFields).length) {
      const translatedSettings = await translateFields('site_content', 'settings', settingFields, lang)
      settings = { ...settings, ...translatedSettings }
    }
  }

  return { treatments, settings, gallery }
}

export default async function HomePage({ params }) {
  const { lang } = await params
  const [{ treatments, settings, gallery }, dict] = await Promise.all([
    getData(lang),
    getDictionary(lang),
  ])

  const schema = spaSchema({
    name:        'Ton Mai Spa',
    url:         'https://www.tonmaispa.com',
    phone:       '+66631175211',
    rating:      settings['settings.google_rating']       ?? '4.8',
    ratingCount: settings['settings.google_review_count'] ?? '369',
    hours: [{ days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], opens: '09:00', closes: '23:00' }],
    address: { street: '6/11 Moo 2 Wiset Road', city: 'Rawai', region: 'Phuket', postalCode: '83130' },
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
      <ScrollReveal />
      <Nav lang={lang} dict={dict} />

      <main id="top">
        <HeroSection settings={settings} dict={dict} />
        <AboutSection dict={dict} />
        <TreatmentsSection treatments={treatments} settings={settings} lang={lang} />
        <ThermoSection dict={dict} />
        <FacilitiesSection dict={dict} />
        <PricingSection settings={settings} dict={dict} />
        <GallerySection gallery={gallery} dict={dict} />
        <ReviewsSection settings={settings} dict={dict} />
        <ContactSection settings={settings} dict={dict} />
      </main>

      <Footer settings={settings} lang={lang} dict={dict} />
      <StickyBookingBar settings={settings} dict={dict} />
    </>
  )
}
