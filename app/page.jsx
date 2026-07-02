// ============================================================
// TON MAI SPA — Homepage
// ISR 60s · All content from Supabase site_content + spa_treatments
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

export const revalidate = 60

export const metadata = {
  title:       'Ton Mai Spa — Garden Spa in Rawai, Phuket',
  description: 'Traditional Thai spa in Rawai, Phuket. Thermal circuit, massage, facials, garden lounge. 5 minutes from Nai Harn Beach. Open daily 09:00–23:00.',
  openGraph: {
    title:       'Ton Mai Spa — Garden Spa in Rawai, Phuket',
    description: 'Traditional Thai spa in Rawai, Phuket. Steam, sauna, cold plunge, pool & massage in a lush tropical garden. Open daily until 11pm.',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
}

async function getData() {
  const admin = createSupabaseAdminClient()

  const [treatmentsRes, settingsRes, galleryRes] = await Promise.all([
    admin.from('spa_treatments')
      .select('id, name, slug, description, category, duration_options, prices, badge, photos')
      .eq('is_active', true)
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

  const settings = Object.fromEntries(
    (settingsRes.data ?? []).map(r => [r.key, r.value_text])
  )

  return {
    treatments: treatmentsRes.data ?? [],
    settings,
    gallery:    galleryRes.data ?? [],
  }
}

export default async function HomePage() {
  const { treatments, settings, gallery } = await getData()

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
      <Nav />

      <main id="top">
        <HeroSection settings={settings} />
        <AboutSection />
        <TreatmentsSection treatments={treatments} settings={settings} />
        <ThermoSection />
        <FacilitiesSection />
        <PricingSection settings={settings} />
        <GallerySection gallery={gallery} />
        <ReviewsSection settings={settings} />
        <ContactSection settings={settings} />
      </main>

      <Footer settings={settings} />
      <StickyBookingBar settings={settings} />
    </>
  )
}
