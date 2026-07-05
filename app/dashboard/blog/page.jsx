import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BlogListClient from './BlogListClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data: posts } = await admin
    .from('blog_posts')
    .select('id, title, slug, category, cover_image_url, publish_date, read_time_minutes, is_published, is_featured, created_at')
    .order('created_at', { ascending: false })
  return { posts: posts ?? [] }
}

export default async function BlogListPage() {
  const { posts } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 8px' }}>Blog Posts</h1>
      <p style={{ font: '400 13px Inter,sans-serif', color: '#6B6663', margin: '0 0 24px' }}>{posts.length} post{posts.length === 1 ? '' : 's'} total</p>
      <BlogListClient initialPosts={posts} />
    </div>
  )
}
