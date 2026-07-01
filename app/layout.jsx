// ============================================================
// TON MAI SPA — Root Layout
// GA4, Vercel Analytics, SpeedInsights, ChatWidget
// ============================================================

import './globals.css'
import { Analytics }      from '@vercel/analytics/react'
import { SpeedInsights }  from '@vercel/speed-insights/next'
import ChatWidget         from '@/components/layout/ChatWidget'
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
  // Load chatbot toggle — fail silently so layout never crashes
  let chatbotEnabled = true
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('site_content')
      .select('value_text')
      .eq('key', 'settings.chatbot_enabled')
      .single()
    chatbotEnabled = data?.value_text !== 'false'
  } catch {}

  return (
    <html lang="en">
      <head>
        {/* Fonts — non-blocking; preconnect first, then stylesheet */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap"
        />
        {/* Preconnect to Cloudinary for gallery/treatment images */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        {/* GA4 — loads only when measurement ID is set */}
        {GA4_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA4_ID}', { page_path: window.location.pathname });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        {children}
        <ChatWidget chatbotEnabled={chatbotEnabled} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
