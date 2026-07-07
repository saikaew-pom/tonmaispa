import Link          from 'next/link'
import Image         from 'next/image'
import { notFound }  from 'next/navigation'
import Nav           from '@/components/layout/Nav'
import Footer         from '@/components/layout/Footer'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { cloudinary }     from '@/lib/display'
import { sanitizeBlogBody } from '@/lib/sanitize'
import { jsonLdScript, breadcrumbSchema } from '@/lib/json-ld'
import { translateFields, translateRows } from '@/lib/translate'
import { LOCALES, getDictionary } from '@/lib/i18n/get-dictionary'
import { t } from '@/lib/i18n/t'

export const revalidate = 60
// New posts get their own page on first visit even without a redeploy.
export const dynamicParams = true

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

async function getPost(slug, lang) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (!data) return null
  if (lang === 'en') return data

  const translated = await translateFields('blog_posts', data.id, {
    title: data.title, excerpt: data.excerpt, body: data.body, category: data.category,
  }, lang)
  return { ...data, ...translated }
}

async function getRelatedPosts(post, lang) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('blog_posts')
    .select('id, title, slug, category, cover_image_url, publish_date, read_time_minutes')
    .eq('is_published', true)
    .eq('category', post.category)
    .neq('id', post.id)
    .order('publish_date', { ascending: false })
    .limit(3)

  let related = data ?? []
  if (lang !== 'en') related = await translateRows('blog_posts', related, ['title'], lang)
  return related
}

// Only pre-render English at build time. Translating a full blog post body
// (long HTML, not a short field like a treatment description) is slow and
// unreliable enough under MiniMax's variable latency to have taken down an
// entire deploy once already (see lib/translate.js's hard timeout note) —
// th/ru/zh render on-demand on first request instead (dynamicParams above),
// then get cached for `revalidate` seconds like any other ISR page.
export async function generateStaticParams() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('blog_posts').select('slug').eq('is_published', true)
  return (data ?? []).map(p => ({ lang: 'en', slug: p.slug }))
}

export async function generateMetadata({ params }) {
  const { slug, lang } = await params
  const post = await getPost(slug, lang)
  if (!post) return { title: 'Post Not Found — Ton Mai Spa' }

  const title = `${post.title} | Ton Mai Spa Blog`
  const description = post.excerpt || `${post.title} — from the Ton Mai Spa blog, Rawai, Phuket.`
  const ogImage = post.cover_image_url ?? `${SITE_URL}/og-image.jpg`

  return {
    title,
    description,
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/blog/${slug}`]),
        ['x-default', `${SITE_URL}/en/blog/${slug}`],
      ]),
    },
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'article',
    },
  }
}

export default async function BlogPostPage({ params }) {
  const { slug, lang } = await params
  const [post, dict] = await Promise.all([getPost(slug, lang), getDictionary(lang)])
  if (!post) notFound()

  const related = await getRelatedPosts(post, lang)
  const bodyHtml = sanitizeBlogBody(post.body)

  const formatDate = (d) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { year: 'numeric', month: 'long', day: 'numeric' })

  const schema = jsonLdScript({
    '@context': 'https://schema.org',
    '@type':    'BlogPosting',
    headline:   post.title,
    description: post.excerpt ?? undefined,
    image:       post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.publish_date,
    dateModified:  post.updated_at ?? post.publish_date,
    author: {
      '@type': 'Organization',
      name:    post.author_name || 'Ton Mai Spa',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ton Mai Spa',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-white.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/${lang}/blog/${slug}` },
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema([
        { name: 'Ton Mai Spa', url: `${SITE_URL}/${lang}` },
        { name: 'Blog', url: `${SITE_URL}/${lang}/blog` },
        { name: post.title },
      ])) }} />
      <Nav lang={lang} dict={dict} />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '400 12px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            <Link href={`/${lang}/blog`} style={{ color: 'rgba(255,255,255,0.6)' }}>{t(dict, 'blog.title')}</Link> / {post.category}
          </div>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{post.category}</div>
          <h1 style={{ font: '400 clamp(32px,6vw,56px)/1.1 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>
            {post.title}
          </h1>
          <div style={{ font: '400 13px Inter,sans-serif', color: 'rgba(255,255,255,0.7)', marginTop: 18 }}>
            {post.author_name || 'Ton Mai Spa'} · {formatDate(post.publish_date)} · {post.read_time_minutes} {t(dict, 'blog.minRead')}
          </div>
        </div>
      </section>

      <main style={{ background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(18px,4vw,40px)' }}>

          {post.cover_image_url && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', marginBottom: 'clamp(32px,4vw,48px)' }}>
              <Image src={cloudinary.hero(post.cover_image_url)} alt={post.title} fill style={{ objectFit: 'cover' }} priority />
            </div>
          )}

          <div
            className="blog-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <Link href={`/${lang}/blog`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6, textDecoration: 'none' }}>
              ← {t(dict, 'blog.backToBlog')}
            </Link>
          </div>
        </div>

        {related.length > 0 && (
          <div style={{ borderTop: '1px solid #E5E0D8', padding: 'clamp(40px,5vw,64px) clamp(18px,4vw,40px)' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#C4924A', marginBottom: 20 }}>{t(dict, 'blog.relatedPosts')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
                {related.map(r => (
                  <Link key={r.id} href={`/${lang}/blog/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 10px rgba(28,25,23,0.06)' }}>
                      {r.cover_image_url && (
                        <div style={{ position: 'relative', height: 140 }}>
                          <Image src={cloudinary.card(r.cover_image_url)} alt={r.title} fill style={{ objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ padding: 16 }}>
                        <h4 style={{ font: '400 16px/1.3 Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>{r.title}</h4>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .blog-body { font: 400 16px/1.8 Inter, sans-serif; color: #3F3A36; }
        .blog-body h3 { font: 400 clamp(20px,2.4vw,26px)/1.3 'Cormorant Garamond', serif; color: #1C1917; margin: 2em 0 0.6em; }
        .blog-body p { margin: 0 0 1.2em; }
        .blog-body ul, .blog-body ol { margin: 0 0 1.2em; padding-left: 1.4em; }
        .blog-body li { margin-bottom: 0.5em; }
        .blog-body strong { color: #1C1917; }
        .blog-body a { color: #3B5249; text-decoration: underline; }
      `}</style>

      <Footer lang={lang} dict={dict} />
    </>
  )
}
