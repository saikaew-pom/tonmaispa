import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BannersClient from './BannersClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const [{ data: banners }, { data: waSetting }] = await Promise.all([
    admin.from('banners').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
    admin.from('site_content').select('value_text').eq('key', 'settings.whatsapp_number').maybeSingle(),
  ])
  return { banners: banners ?? [], defaultWhatsapp: waSetting?.value_text ?? '' }
}

export default async function BannersPage() {
  const { banners, defaultWhatsapp } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 8px' }}>Banners</h1>
      <p style={{ font: '400 13px Inter,sans-serif', color: '#6B6663', margin: '0 0 24px' }}>
        Popup banners shown to public site visitors — scheduled, delayed, or shown immediately, with an optional image and call-to-action button.
      </p>
      <BannersClient initialBanners={banners} defaultWhatsapp={defaultWhatsapp} />
    </div>
  )
}
