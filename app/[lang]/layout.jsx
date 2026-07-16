import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/get-dictionary'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSettingsMap } from '@/lib/site-settings'
import { maintenanceOn, MAINTENANCE_KEY } from '@/lib/maintenance'
import MaintenanceScreen from '@/components/sections/MaintenanceScreen'
import SetHtmlLang from './SetHtmlLang'

export function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }))
}

// Gate every public page here rather than in middleware: this render is ISR'd,
// so a cached page pays nothing, whereas middleware would add a DB round-trip
// to every request (and the / -> /en rewrite exists precisely to protect mobile
// LCP). /dashboard and /login sit outside /[lang], so staff can always reach
// the toggle to switch it back off.
async function readMaintenance() {
  try {
    const admin = createSupabaseAdminClient()
    const settings = await getSettingsMap(admin, [MAINTENANCE_KEY, 'settings.whatsapp_number'])
    return {
      on: maintenanceOn(settings[MAINTENANCE_KEY]),
      whatsapp: settings['settings.whatsapp_number'] || '66822866058',
    }
  } catch {
    return { on: false, whatsapp: '66822866058' } // fail open — never black out a working site
  }
}

// No [lang] page sets `robots`, so this is the one that applies: keep the
// holding page out of the index, or Google can cache "we are closed" as the
// spa's real content long after it reopens.
export async function generateMetadata() {
  const { on } = await readMaintenance()
  return on ? { robots: { index: false, follow: false } } : {}
}

export default async function LangLayout({ children, params }) {
  const { lang } = await params
  if (!LOCALES.includes(lang)) notFound()

  const { on, whatsapp } = await readMaintenance()

  return (
    <>
      <SetHtmlLang lang={lang} />
      {on ? <MaintenanceScreen lang={lang} whatsapp={whatsapp} /> : children}
    </>
  )
}
