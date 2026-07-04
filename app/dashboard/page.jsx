import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getRevenueSummary, getTherapistUtilizationSummary, getForwardBookingSummary } from '@/lib/insights'
import OverviewClient from './OverviewClient'

export const dynamic = 'force-dynamic'

const pad = n => String(n).padStart(2, '0')
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

async function getData() {
  const admin = createSupabaseAdminClient()
  const today = new Date()
  const start = new Date(today); start.setDate(start.getDate() - 6) // default: last 7 days incl. today
  const startDate = toYMD(start)
  const endDate = toYMD(today)

  const [revenue, therapistUtilization, forwardBookings, newEnquiries, recentEnquiries, upcoming, statusBreakdown] = await Promise.all([
    getRevenueSummary(admin, { startDate, endDate }),
    getTherapistUtilizationSummary(admin, { startDate, endDate }),
    getForwardBookingSummary(admin),
    admin.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('enquiries').select('id, name, phone, status, created_at').order('created_at', { ascending: false }).limit(5),
    admin.from('bookings').select('id, guest_name, date, time_slot, status, spa_treatments(name)').gte('date', endDate).order('date').order('time_slot').limit(8),
    admin.from('bookings').select('status').gte('date', startDate).lte('date', endDate),
  ])

  const statusCounts = {}
  for (const b of statusBreakdown.data ?? []) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1

  return {
    defaultRange: { startDate, endDate },
    revenue,
    therapistUtilization,
    forwardBookings,
    newEnquiriesCount: newEnquiries.count ?? 0,
    recentEnquiries: recentEnquiries.data ?? [],
    upcoming: upcoming.data ?? [],
    statusCounts,
  }
}

export default async function DashboardOverview() {
  const data = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Overview</h1>
      <OverviewClient {...data} />
    </div>
  )
}
