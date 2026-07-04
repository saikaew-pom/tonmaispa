import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getEligibleBanner } from '@/lib/banners'

// GET /api/banners/active — public, no auth. Returns the single highest-
// priority banner currently eligible to show, or { banner: null }. Resolves
// a whatsapp/call CTA's phone number here (banner override, else the
// site-wide settings.whatsapp_number) so the client never needs a second call.
export async function GET() {
  const admin = createSupabaseAdminClient()

  const banner = await getEligibleBanner(admin)
  if (!banner) return Response.json({ banner: null })

  if ((banner.cta_type === 'whatsapp' || banner.cta_type === 'call') && !banner.cta_value) {
    const { data } = await admin
      .from('site_content').select('value_text').eq('key', 'settings.whatsapp_number').maybeSingle()
    banner.cta_value = data?.value_text ?? null
  }

  return Response.json({ banner })
}
