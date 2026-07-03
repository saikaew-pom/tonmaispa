import { requireAdmin } from '@/lib/require-admin'
import { isFeatureEnabled } from '@/lib/site-settings'

// GET /api/admin/campaigns — list past campaigns
// GET /api/admin/campaigns?id=uuid — fetch one full campaign (incl. draft/critique for the fact-check panel)
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
  if (!(await isFeatureEnabled(auth.admin, 'settings.campaigns_enabled'))) {
    return Response.json({ error: 'This feature is not enabled' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await auth.admin
      .from('campaigns')
      .select('id, name, objective, budget_thb, period_start, period_end, audience, constraints, status, draft_plan, critique, plan, created_at, updated_at')
      .eq('id', id)
      .single()
    if (error) return Response.json({ error: error.message }, { status: 404 })
    return Response.json({ campaign: data })
  }

  const { data, error } = await auth.admin
    .from('campaigns')
    .select('id, name, objective, status, period_start, period_end, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ campaigns: data ?? [] })
}
