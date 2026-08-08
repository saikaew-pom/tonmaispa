// ============================================================
// TON MAI SPA — Root Layout
// GA4, Vercel Analytics, SpeedInsights, ChatWidget
// ============================================================

import './globals.css'
import { Analytics }      from '@vercel/analytics/react'
import { SpeedInsights }  from '@vercel/speed-insights/next'
import ChatWidget         from '@/components/layout/ChatWidget'
import GoogleAnalytics    from '@/components/layout/GoogleAnalytics'
import CookieConsentBanner from '@/components/layout/CookieConsentBanner'
import BannerPopup        from '@/components/layout/BannerPopup'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'
const GA4_ID    = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  'Ton Mai Spa — Garden Spa in Rawai, Phuket',
    template: '%s | Ton Mai Spa',
  },
  description: 'Traditional Thai spa in Rawai, Phuket. Thermal circuit, massage, facials, garden lounge. 5 minutes from Nai Harn Beach. Open daily 09:00–23:00.',
  keywords:    ['spa rawai phuket', 'thai massage rawai', 'garden spa phuket', 'sauna cold plunge phuket', 'nai harn spa'],
  openGraph: {
    type:        'website',
    siteName:    'Ton Mai Spa',
    locale:      'en_US',
  },
  robots: {
    index:  true,
    follow: true,
  },
}

export default async function RootLayout({ children }) {
  // Load chatbot toggle — fail silently so layout never crashes if a query
  // hiccups. Maintenance mode also silences the bot: the holding page promises
  // WhatsApp and nothing else, so a chat bubble over it would be a second
  // channel we haven't promised to answer. The MIDDLEWARE is the real
  // maintenance gate (lib/maintenance.js) — this read only decides the widget,
  // so its staleness on an ISR page is cosmetic, never a black-out. On the
  // /maintenance route (force-dynamic) this read is fresh, so the bubble is
  // reliably hidden exactly where it matters.
  let chatbotEnabled = true
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('site_content')
      .select('key, value_text')
      .in('key', ['settings.chatbot_enabled', 'settings.maintenance_mode'])
    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value_text]))
    const maintenance = String(map['settings.maintenance_mode'] ?? '').trim().toLowerCase() === 'true'
    chatbotEnabled = map['settings.chatbot_enabled'] !== 'false' && !maintenance
  } catch {}

  return (
    <html lang="en">
      <head>
        {/* Fonts are self-hosted (see globals.css @font-face) — the old
            fonts.googleapis.com stylesheet was render-blocking (~1s mobile
            FCP) and its late swap caused the hero headline layout shift.
            Preload the two latin variable files every page paints with. */}
        <link rel="preload" href="/fonts/cormorant-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* Preconnect to Cloudinary for gallery/treatment images */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
      </head>
      <body>
        {children}
        <BannerPopup />
        <ChatWidget chatbotEnabled={chatbotEnabled} />
        {/* GA4 — only injects the script + sets cookies after the visitor consents */}
        {GA4_ID && <GoogleAnalytics gaId={GA4_ID} />}
        <CookieConsentBanner />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
