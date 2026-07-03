import { requireAdmin } from '@/lib/require-admin'
import { renderInsightsPdf, renderInsightsDocx } from '@/lib/insights-export'

// GET /api/admin/insights/[id]/export?format=pdf|docx
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format')
  if (!['pdf', 'docx'].includes(format)) {
    return Response.json({ error: 'format must be pdf or docx' }, { status: 400 })
  }

  const { data: insight, error } = await auth.admin
    .from('revenue_insights')
    .select('period_start, period_end, recommendations')
    .eq('id', id)
    .single()
  if (error || !insight) return Response.json({ error: 'Insight not found' }, { status: 404 })

  const filename = `revenue-marketing-advisor-${insight.period_start}-to-${insight.period_end}`

  if (format === 'pdf') {
    const buffer = await renderInsightsPdf(insight)
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  const buffer = await renderInsightsDocx(insight)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}.docx"`,
    },
  })
}
