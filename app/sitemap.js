import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export default async function sitemap() {
  const admin = createSupabaseAdminClient()

  // Blog posts (Phase 2 — empty until then)
  const { data: posts } = await admin
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('status', 'published')

  const staticPages = [
    { url: `${BASE}/`,           priority: 1.0, changeFrequency: 'weekly'  },
    { url: `${BASE}/spa-menu`,   priority: 0.9, changeFrequency: 'monthly' },
    { url: `${BASE}/restaurant`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/book`,       priority: 0.9, changeFrequency: 'weekly'  },
  ]

  const blogPages = (posts ?? []).map(p => ({
    url:             `${BASE}/blog/${p.slug}`,
    lastModified:    p.updated_at,
    priority:        0.6,
    changeFrequency: 'monthly',
  }))

  return [...staticPages, ...blogPages]
}
