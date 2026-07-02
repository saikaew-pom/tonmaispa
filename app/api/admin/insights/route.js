import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/insights — list past recommendations (history)
// GET /api/admin/insights?id=uuid — fetch one full past result
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await auth.admin
      .from('revenue_insights')
      .select('id, period_start, period_end, created_at, recommendations, input_summary')
      .eq('id', id)
      .single()
    if (error) return Response.json({ error: error.message }, { status: 404 })
    return Response.json({ insight: data })
  }

  const { data, error } = await auth.admin
    .from('revenue_insights')
    .select('id, period_start, period_end, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ insights: data ?? [] })
}
