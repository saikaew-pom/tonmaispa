import { createSupabaseAdminClient } from '@/lib/supabase-admin'

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

  // Homepage now lives under /[lang]/ — spa-menu/restaurant/book haven't
  // migrated yet (later phase) and stay at their unprefixed English URLs.
  const staticPages = [
    { url: `${BASE}/en`,         priority: 1.0, changeFrequency: 'weekly'  },
    { url: `${BASE}/ru`,         priority: 0.9, changeFrequency: 'weekly'  },
    { url: `${BASE}/zh`,         priority: 0.9, changeFrequency: 'weekly'  },
    { url: `${BASE}/th`,         priority: 0.9, changeFrequency: 'weekly'  },
    { url: `${BASE}/spa-menu`,   priority: 0.9, changeFrequency: 'monthly' },
    { url: `${BASE}/restaurant`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/book`,       priority: 0.9, changeFrequency: 'weekly'  },
  ]

  const treatmentPages = (treatments ?? []).map(t => ({
    url:             `${BASE}/spa-menu/${t.slug}`,
    lastModified:    t.created_at,
    priority:        0.7,
    changeFrequency: 'monthly',
  }))

  const blogPages = (posts ?? []).map(p => ({
    url:             `${BASE}/blog/${p.slug}`,
    lastModified:    p.updated_at,
    priority:        0.6,
    changeFrequency: 'monthly',
  }))

  return [...staticPages, ...treatmentPages, ...blogPages]
}
