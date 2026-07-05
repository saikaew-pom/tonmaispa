import { requireAdmin } from '@/lib/require-admin'
import { estimateReadTime } from '@/lib/blog'

// GET /api/admin/blog/[id] — full post for editing
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { data: post, error } = await auth.admin.from('blog_posts').select('*').eq('id', id).single()
  if (error || !post) return Response.json({ error: 'Post not found' }, { status: 404 })
  return Response.json({ post })
}

// PATCH /api/admin/blog/[id] — partial update, any field
export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()

  const allowedKeys = [
    'title', 'slug', 'category', 'excerpt', 'cover_image_url', 'body', 'author_name',
    'tags', 'publish_date', 'read_time_minutes', 'is_published', 'is_featured',
  ]
  const updates = { updated_at: new Date().toISOString() }
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key]
  }
  // Only auto-recompute read time if the caller didn't explicitly set one
  // this same request — an explicit override should never be silently redone.
  if ('body' in body && !('read_time_minutes' in body)) {
    updates.read_time_minutes = estimateReadTime(body.body)
  }

  const { data: post, error } = await auth.admin
    .from('blog_posts').update(updates).eq('id', id)
    .select('*').single()

  if (error) {
    const message = error.code === '23505' ? 'A post with this URL slug already exists.' : error.message
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json({ post })
}

// DELETE /api/admin/blog/[id]
export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { error } = await auth.admin.from('blog_posts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
