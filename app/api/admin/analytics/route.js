import { requireOwnerOrAbove } from '@/lib/require-admin'
import { getAnalyticsSummary, resolvePeriod } from '@/lib/ga4'

// GET /api/admin/analytics?period=7d|30d|90d|all|custom&start=&end=
export async function GET(req) {
  const auth = await requireOwnerOrAbove()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '30d'
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')

  const { startDate, endDate } = resolvePeriod(period, { customStart, customEnd })

  try {
    const summary = await getAnalyticsSummary({ startDate, endDate })
    if (!summary) {
      return Response.json({ error: 'GA4 is not configured yet — missing GA4_PROPERTY_ID or service account credentials.' }, { status: 501 })
    }
    return Response.json({ summary })
  } catch (err) {
    console.error('[analytics] GA4 query failed:', err.message)
    return Response.json({ error: 'Could not load analytics data. Confirm the service account has Viewer access on the GA4 property.' }, { status: 502 })
  }
}
