import { requireAdmin } from '@/lib/require-admin'
import { generateExcerpt } from '@/lib/blog-ai'

// POST /api/admin/blog/generate-excerpt — { body } -> AI 1-2 sentence excerpt
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { body } = await req.json()
  if (!body || !body.trim()) {
    return Response.json({ error: 'Write some article body first' }, { status: 400 })
  }

  const excerpt = await generateExcerpt({ body })
  if (!excerpt) {
    return Response.json({ error: 'Could not generate an excerpt right now. Try again in a moment.' }, { status: 502 })
  }
  return Response.json({ excerpt })
}
