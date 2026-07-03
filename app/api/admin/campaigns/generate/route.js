import { requireAdmin } from '@/lib/require-admin'
import { isFeatureEnabled } from '@/lib/site-settings'
import { buildCampaignContext, generateCampaignPlan } from '@/lib/campaigns'

// 3 sequential MiniMax calls (draft -> critique -> distill) can take several
// minutes combined against this model. Use the highest duration Vercel
// allows for this project's plan; if it's still not enough in production,
// the pipeline needs to move to a background job instead of a single request.
export const maxDuration = 300

// POST /api/admin/campaigns/generate
// Body: { objective, audience?, budgetTHB?, periodStart, periodEnd, channels?, constraints? }
//    or { freeText, periodStart, periodEnd } for the natural-language shortcut
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
  if (!(await isFeatureEnabled(auth.admin, 'settings.campaigns_enabled'))) {
    return Response.json({ error: 'This feature is not enabled' }, { status: 403 })
  }

  const body = await req.json()
  const { freeText, objective, audience, budgetTHB, periodStart, periodEnd, channels, constraints } = body

  if (!periodStart || !periodEnd || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return Response.json({ error: 'periodStart and periodEnd (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (!freeText && !objective) {
    return Response.json({ error: 'Provide either freeText or a structured objective' }, { status: 400 })
  }

  const brief = freeText
    ? { freeText, periodStart, periodEnd }
    : { objective, audience, budgetTHB, periodStart, periodEnd, channels, constraints }

  const context = await buildCampaignContext(auth.admin)
  const result = await generateCampaignPlan({ brief, context })

  if (!result) {
    return Response.json({ error: 'Could not generate a campaign plan. Please try again.' }, { status: 502 })
  }

  const interpreted = result.finalPlan?.interpretedBrief ?? {}
  const name = interpreted.objective || objective || freeText?.slice(0, 60) || 'Untitled campaign'

  const { data: saved, error } = await auth.admin
    .from('campaigns')
    .insert({
      name: name.length > 120 ? name.slice(0, 117) + '...' : name,
      objective: objective || interpreted.objective || freeText || '',
      budget_thb: budgetTHB ?? interpreted.budgetTHB ?? null,
      period_start: periodStart,
      period_end: periodEnd,
      audience: audience ?? interpreted.audience ?? null,
      constraints: constraints ?? null,
      input_context: context,
      draft_plan: result.draftPlan,
      critique: result.critique,
      plan: result.finalPlan,
      requested_by: auth.session.user.id,
    })
    .select('id, created_at')
    .single()

  if (error) console.error('[campaigns] failed to persist campaign:', error.message)

  return Response.json({ id: saved?.id ?? null, plan: result.finalPlan })
}
