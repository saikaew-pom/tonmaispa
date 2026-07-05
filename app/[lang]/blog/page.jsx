import Link                          from 'next/link'
import Image                         from 'next/image'
import Nav                           from '@/components/layout/Nav'
import Footer                        from '@/components/layout/Footer'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { cloudinary }                from '@/lib/display'
import { translateRows }             from '@/lib/translate'
import { LOCALES, getDictionary }    from '@/lib/i18n/get-dictionary'
import { t }                         from '@/lib/i18n/t'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export function generateMetadata({ params }) {
  return {
    title:       'Blog — Wellness, Thai Massage & Phuket Guides | Ton Mai Spa',
    description: 'Guides on Thai massage, our thermal wellness circuit, Rawai & Nai Harn, healthy Thai food, and planning your spa visit in Phuket.',
    alternates: {
      languages: Object.fromEntries([
        ...LOCALES.map(l => [l, `${SITE_URL}/${l}/blog`]),
        ['x-default', `${SITE_URL}/en/blog`],
      ]),
    },
    openGraph: {
      title:       'Ton Mai Spa Blog',
      description: 'Wellness guides, Thai massage explainers, and Phuket travel tips from Ton Mai Spa.',
      images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  }
}

async function getPosts(lang) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('blog_posts')
    .select('id, title, slug, category, excerpt, cover_image_url, author_name, publish_date, read_time_minutes, is_featured')
    .eq('is_published', true)
    .order('publish_date', { ascending: false })

  let posts = data ?? []
  if (lang !== 'en') {
    posts = await translateRows('blog_posts', posts, ['title', 'excerpt', 'category'], lang)
  }
  return posts
}

export default async function BlogIndexPage({ params }) {
  const { lang } = await params
  const [posts, dict] = await Promise.all([getPosts(lang), getDictionary(lang)])

  const featured = posts.find(p => p.is_featured) ?? posts[0] ?? null
  const rest = featured ? posts.filter(p => p.id !== featured.id) : posts
  const categories = [...new Set(posts.map(p => p.category))]

  const formatDate = (d) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <Nav lang={lang} dict={dict} />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>{t(dict, 'blog.tonMaiSpa')}</div>
          <h1 style={{ font: '400 clamp(38px,7vw,72px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>
            {t(dict, 'blog.title')}
          </h1>
          <p style={{ font: '400 clamp(14px,1.2vw,17px)/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.8)', margin: '16px 0 0', maxWidth: '52ch' }}>
            {t(dict, 'blog.heroText')}
          </p>
        </div>
      </section>

      <main style={{ background: '#FAF6F0' }}>
        {posts.length === 0 ? (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(64px,8vw,120px) clamp(18px,4vw,40px)', textAlign: 'center' }}>
            <p style={{ font: '400 16px Inter,sans-serif', color: '#6B6663' }}>{t(dict, 'blog.noPosts')}</p>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,6vw,80px) clamp(18px,4vw,40px)' }}>

            {/* Category filter chips */}
            {categories.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'clamp(32px,4vw,48px)' }}>
                {categories.map(cat => (
                  <span key={cat} style={{ padding: '8px 16px', border: '1px solid #E5E0D8', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#3B5249', background: '#fff' }}>
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Featured post */}
            {featured && (
              <Link href={`/${lang}/blog/${featured.slug}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 'clamp(40px,5vw,64px)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 'clamp(20px,3vw,40px)', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 16px rgba(28,25,23,0.08)' }} className="blog-featured">
                  {featured.cover_image_url && (
                    <div style={{ position: 'relative', minHeight: 240 }}>
                      <Image src={cloudinary.hero(featured.cover_image_url)} alt={featured.title} fill style={{ objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: 'clamp(24px,3vw,40px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#C4924A' }}>{featured.category}</div>
                    <h2 style={{ font: '400 clamp(24px,3vw,36px)/1.15 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>{featured.title}</h2>
                    {featured.excerpt && (
                      <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663', margin: '12px 0 0' }}>{featured.excerpt}</p>
                    )}
                    <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 16 }}>
                      {formatDate(featured.publish_date)} · {featured.read_time_minutes} {t(dict, 'blog.minRead')}
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Grid of remaining posts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 'clamp(20px,2.5vw,32px)' }}>
              {rest.map(post => (
                <Link key={post.id} href={`/${lang}/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 12px rgba(28,25,23,0.06)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {post.cover_image_url && (
                      <div style={{ position: 'relative', height: 200 }}>
                        <Image src={cloudinary.card(post.cover_image_url)} alt={post.title} fill style={{ objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ padding: 'clamp(18px,2vw,24px)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4924A' }}>{post.category}</div>
                      <h3 style={{ font: '400 clamp(18px,1.8vw,22px)/1.25 Cormorant Garamond,serif', color: '#1C1917', margin: '10px 0 0' }}>{post.title}</h3>
                      {post.excerpt && (
                        <p style={{ font: '400 13px/1.65 Inter,sans-serif', color: '#6B6663', margin: '10px 0 0', flex: 1 }}>{post.excerpt}</p>
                      )}
                      <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 14 }}>
                        {formatDate(post.publish_date)} · {post.read_time_minutes} {t(dict, 'blog.minRead')}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 720px) {
          .blog-featured { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer lang={lang} dict={dict} />
    </>
  )
}
