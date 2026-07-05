import { requireAdmin } from '@/lib/require-admin'
import { slugify, estimateReadTime } from '@/lib/blog'

// GET /api/admin/blog?search=&category=&status= — list for the dashboard
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')
  const status = searchParams.get('status') // 'published' | 'draft'

  let query = auth.admin
    .from('blog_posts')
    .select('id, title, slug, category, excerpt, cover_image_url, publish_date, read_time_minutes, is_published, is_featured, created_at')
    .order('created_at', { ascending: false })

  if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)
  if (category) query = query.eq('category', category)
  if (status === 'published') query = query.eq('is_published', true)
  if (status === 'draft') query = query.eq('is_published', false)

  const { data: posts, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ posts: posts ?? [] })
}

// POST /api/admin/blog — create a new post
export async function POST(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const { title, category } = body
  if (!title || !category) {
    return Response.json({ error: 'Title and category are required' }, { status: 400 })
  }

  const slug = body.slug?.trim() || slugify(title)
  const readTime = body.read_time_minutes ?? (body.body ? estimateReadTime(body.body) : null)

  const { data: post, error } = await auth.admin
    .from('blog_posts')
    .insert({
      title, category, slug,
      excerpt:           body.excerpt || null,
      cover_image_url:   body.cover_image_url || null,
      body:              body.body || null,
      author_name:       body.author_name || null,
      tags:              body.tags || [],
      publish_date:      body.publish_date || new Date().toISOString().slice(0, 10),
      read_time_minutes: readTime,
      is_published:      body.is_published ?? false,
      is_featured:        body.is_featured ?? false,
    })
    .select('*')
    .single()

  if (error) {
    const message = error.code === '23505' ? 'A post with this URL slug already exists.' : error.message
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json({ post })
}
