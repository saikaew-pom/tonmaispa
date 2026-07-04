import { requireAdmin } from '@/lib/require-admin'
import { getRevenueSummary, getTherapistUtilizationSummary, getForwardBookingSummary } from '@/lib/insights'

// GET /api/admin/overview?startDate&endDate — powers the dashboard Overview
// page's period filter. Reuses the same aggregation functions as the
// Revenue & Marketing Advisor so the two never disagree about what
// "revenue this period" means.
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return Response.json({ error: 'startDate and endDate (YYYY-MM-DD) are required' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const [
    revenue, therapistUtilization, forwardBookings,
    newEnquiries, recentEnquiries, upcoming, statusBreakdown,
  ] = await Promise.all([
    getRevenueSummary(auth.admin, { startDate, endDate }),
    getTherapistUtilizationSummary(auth.admin, { startDate, endDate }),
    getForwardBookingSummary(auth.admin),
    auth.admin.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    auth.admin.from('enquiries').select('id, name, phone, status, created_at').order('created_at', { ascending: false }).limit(5),
    auth.admin.from('bookings').select('id, guest_name, date, time_slot, status, spa_treatments(name)').gte('date', today).order('date').order('time_slot').limit(8),
    auth.admin.from('bookings').select('status').gte('date', startDate).lte('date', endDate),
  ])

  const statusCounts = {}
  for (const b of statusBreakdown.data ?? []) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1

  return Response.json({
    revenue,
    therapistUtilization,
    forwardBookings,
    newEnquiriesCount: newEnquiries.count ?? 0,
    recentEnquiries: recentEnquiries.data ?? [],
    upcoming: upcoming.data ?? [],
    statusCounts,
  })
}
