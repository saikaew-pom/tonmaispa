import { requireAdmin } from '@/lib/require-admin'
import { isFeatureEnabled } from '@/lib/site-settings'
import { getRevenueSummary, getTherapistUtilizationSummary, getForwardBookingSummary, getMarketingFunnelSummary, generateRecommendations } from '@/lib/insights'

// 3 sequential MiniMax calls (draft -> critique -> distill) can take several
// minutes combined against this model — see lib/ai-critique.js. Use the
// highest duration Vercel allows for this project's plan.
export const maxDuration = 300

// POST /api/admin/insights/generate — { startDate, endDate }
// Aggregates historical revenue/therapist/marketing data for the selected
// period plus everything already on the books going forward, asks MiniMax
// for grounded revenue + marketing recommendations (via the 3-stage
// self-critique pipeline), and persists the result.
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
  if (!(await isFeatureEnabled(auth.admin, 'settings.insights_enabled'))) {
    return Response.json({ error: 'This feature is not enabled' }, { status: 403 })
  }

  const { startDate, endDate } = await req.json()
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return Response.json({ error: 'startDate and endDate (YYYY-MM-DD) are required' }, { status: 400 })
  }

  const [revenue, therapistUtilization, forwardBookings, marketingFunnel] = await Promise.all([
    getRevenueSummary(auth.admin, { startDate, endDate }),
    getTherapistUtilizationSummary(auth.admin, { startDate, endDate }),
    getForwardBookingSummary(auth.admin),
    getMarketingFunnelSummary(auth.admin, { startDate, endDate }),
  ])

  const inputSummary = { revenue, therapistUtilization, forwardBookings, marketingFunnel }
  const result = await generateRecommendations(inputSummary)

  if (!result) {
    return Response.json({ error: 'Could not generate recommendations. Please try again.' }, { status: 502 })
  }

  const { data: saved, error } = await auth.admin
    .from('revenue_insights')
    .insert({
      period_start: startDate,
      period_end: endDate,
      requested_by: auth.session.user.id,
      input_summary: inputSummary,
      draft_recommendations: result.draftRecommendations,
      critique: result.critique,
      recommendations: result.finalRecommendations,
    })
    .select('id, created_at')
    .single()

  if (error) console.error('[insights] failed to persist recommendation:', error.message)

  return Response.json({
    id: saved?.id ?? null,
    summary: { revenue, therapistUtilization, forwardBookings, marketingFunnel },
    recommendations: result.finalRecommendations,
    critique: result.critique,
  })
}
