// The WhatsApp-only holding page. Middleware rewrites every public path here
// while settings.maintenance_mode is on.
//
// force-dynamic: this render is NEVER prerendered or ISR-cached — the exact
// property the first attempt lacked. It also re-reads the flag itself and, if
// it's actually OFF, sends the visitor home rather than trapping them behind a
// stale rewrite. Belt and suspenders.

import { redirect } from 'next/navigation'
import MaintenanceScreen from '@/components/sections/MaintenanceScreen'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { maintenanceOn, MAINTENANCE_KEY } from '@/lib/maintenance'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const LOCALES = ['en', 'ru', 'zh', 'th']

export default async function MaintenancePage({ searchParams }) {
  const sp = await searchParams
  const lang = LOCALES.includes(sp?.lang) ? sp.lang : 'en'
  const previewForced = sp?.__maint === '1' // preview override (never set in prod)

  let on = previewForced
  let whatsapp = '66822866058'
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('site_content')
      .select('key, value_text')
      .in('key', [MAINTENANCE_KEY, 'settings.whatsapp_number'])
    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value_text]))
    if (!previewForced) on = maintenanceOn(map[MAINTENANCE_KEY])
    whatsapp = map['settings.whatsapp_number'] || whatsapp
  } catch {
    // If we can't read the flag, don't trap anyone: only stay on this page when
    // the render was explicitly preview-forced; otherwise fall through to home.
    if (!previewForced) on = false
  }

  // redirect() throws NEXT_REDIRECT — keep it outside any try/catch.
  if (!on) redirect(`/${lang}`)

  return <MaintenanceScreen lang={lang} whatsapp={whatsapp} />
}
