import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { LOCALES } from '@/lib/i18n/get-dictionary'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export default async function sitemap() {
  const admin = createSupabaseAdminClient()

  // Every active treatment gets its own indexable page — added here
  // automatically, so a new treatment created in the dashboard is in the
  // sitemap on the very next crawl with no code changes needed.
  const { data: treatments } = await admin
    .from('spa_treatments')
    .select('slug, created_at')
    .eq('is_active', true)

  // Blog posts (Phase 2 — empty until then)
  const { data: posts } = await admin
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('status', 'published')

  // All customer-facing pages now live under /[lang]/.
  const localizedPages = ['', '/spa-menu', '/restaurant', '/book', '/privacy', '/terms']
  const staticPages = LOCALES.flatMap(lang =>
    localizedPages.map(page => ({
      url:             `${BASE}/${lang}${page}`,
      priority:        page === '' ? 1.0 : page === '/privacy' || page === '/terms' ? 0.3 : 0.9,
      changeFrequency: page === '' || page === '/book' ? 'weekly' : 'monthly',
    }))
  )

  const treatmentPages = LOCALES.flatMap(lang =>
    (treatments ?? []).map(t => ({
      url:             `${BASE}/${lang}/spa-menu/${t.slug}`,
      lastModified:    t.created_at,
      priority:        0.7,
      changeFrequency: 'monthly',
    }))
  )

  const blogPages = (posts ?? []).map(p => ({
    url:             `${BASE}/blog/${p.slug}`,
    lastModified:    p.updated_at,
    priority:        0.6,
    changeFrequency: 'monthly',
  }))

  return [...staticPages, ...treatmentPages, ...blogPages]
}
