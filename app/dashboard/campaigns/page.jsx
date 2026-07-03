import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { buildCampaignContext } from '@/lib/campaigns'
import CampaignsClient from './CampaignsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()

  const [context, campaignsRes] = await Promise.all([
    buildCampaignContext(admin),
    admin.from('campaigns').select('id, name, objective, status, period_start, period_end, created_at').order('created_at', { ascending: false }).limit(50),
  ])

  return {
    context,
    campaigns: campaignsRes.data ?? [],
  }
}

export default async function CampaignsPage({ searchParams }) {
  const params = await searchParams
  const data = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>AI Campaign Planner</h1>
      <CampaignsClient {...data} prefillObjective={params?.objective ?? ''} />
    </div>
  )
}
