import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BlogEditorClient from './BlogEditorClient'

export const dynamic = 'force-dynamic'

export default async function BlogEditorPage({ params }) {
  const { id } = await params
  const isNew = id === 'new'

  let post = null
  if (!isNew) {
    const admin = createSupabaseAdminClient()
    const { data } = await admin.from('blog_posts').select('*').eq('id', id).single()
    post = data
  }

  return (
    <div>
      <BlogEditorClient initialPost={post} isNew={isNew} />
    </div>
  )
}
