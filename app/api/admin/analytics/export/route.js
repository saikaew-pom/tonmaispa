import { requireOwnerOrAbove } from '@/lib/require-admin'
import { getAnalyticsSummary, resolvePeriod } from '@/lib/ga4'
import { renderAnalyticsPdf } from '@/lib/analytics-export'

// GET /api/admin/analytics/export?period=7d|30d|90d|all|custom&start=&end=
// Renders fresh from a live GA4 call for the requested period — not cached,
// always matches what's on screen.
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

  const buffer = await renderAnalyticsPdf(summary)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="website-analytics-${summary.period.startDate}-to-${summary.period.endDate}.pdf"`,
    },
  })
}
