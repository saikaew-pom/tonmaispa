import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getRevenueSummary, getTherapistUtilizationSummary } from '@/lib/insights'
import InsightsClient from './InsightsClient'

export const dynamic = 'force-dynamic'

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

async function getData() {
  const admin = createSupabaseAdminClient()
  const today = new Date()
  const start = new Date(today); start.setDate(start.getDate() - 30)
  const startDate = toYMD(start)
  const endDate = toYMD(today)

  const [revenue, therapistUtilization, insightsRes] = await Promise.all([
    getRevenueSummary(admin, { startDate, endDate }),
    getTherapistUtilizationSummary(admin, { startDate, endDate }),
    admin.from('revenue_insights').select('id, period_start, period_end, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  return {
    defaultRange: { startDate, endDate },
    revenue,
    therapistUtilization,
    history: insightsRes.data ?? [],
  }
}

export default async function InsightsPage() {
  const data = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Revenue &amp; Marketing Advisor</h1>
      <InsightsClient {...data} />
    </div>
  )
}
