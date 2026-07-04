import { requireOwnerOrAbove } from '@/lib/require-admin'
import { getAnalyticsSummary, resolvePeriod } from '@/lib/ga4'
import { interpretAnalytics } from '@/lib/analytics-interpret'

// GET /api/admin/analytics/interpret?period=7d|30d|90d|all|custom&start=&end=
// Separate, slower endpoint (MiniMax call) so the KPI numbers can render
// instantly from /api/admin/analytics while this streams in behind it.
export async function GET(req) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '30d'
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')
  const { startDate, endDate } = resolvePeriod(period, { customStart, customEnd })

  const summary = await getAnalyticsSummary({ startDate, endDate })
  if (!summary) return Response.json({ error: 'GA4 is not configured yet' }, { status: 501 })

  const interpretation = await interpretAnalytics(summary)
  if (!interpretation) {
    return Response.json({ error: 'Could not generate an interpretation right now. Try again in a moment.' }, { status: 502 })
  }
  return Response.json({ interpretation })
}
