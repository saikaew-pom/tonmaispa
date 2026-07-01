import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('site_content').select('key, value_text').eq('page', 'settings').order('key')
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value_text]))
}

export default async function SettingsPage() {
  const settings = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Settings</h1>
      <SettingsClient initialSettings={settings} />
    </div>
  )
}
