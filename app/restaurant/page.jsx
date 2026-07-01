import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { jsonLdScript } from '@/lib/json-ld'

export const revalidate = 60

export const metadata = {
  title:       'Garden Restaurant Menu — Ton Mai Spa | Rawai Phuket',
  description: 'Open-air garden dining at Ton Mai Spa, Rawai Phuket. Thai food, international dishes, fresh juices, smoothies and cocktails. Open daily 09:00–23:00.',
  alternates:  { canonical: '/restaurant' },
  openGraph: {
    title:       'Garden Restaurant — Ton Mai Spa',
    description: 'Thai & international food in a tropical garden setting in Rawai, Phuket.',
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
}

async function getData() {
  const admin = createSupabaseAdminClient()
  const [catRes, itemRes, stRes] = await Promise.all([
    admin.from('menu_categories').select('id,name,slug,type').order('sort_order'),
    admin.from('menu_items').select('id,category_id,name,description,price,price_note,badge,tags,is_recommended').eq('is_active', true).order('sort_order'),
    admin.from('site_content').select('key,value_text').eq('page', 'settings'),
  ])
  const settings   = Object.fromEntries((stRes.data ?? []).map(r => [r.key, r.value_text]))
  const categories = catRes.data ?? []
  const items      = itemRes.data ?? []
  // index items by category_id
  const byCategory = {}
  items.forEach(item => { (byCategory[item.category_id] ??= []).push(item) })
  const food   = categories.filter(c => c.type === 'food')
  const drinks = categories.filter(c => c.type === 'drink')
  return { food, drinks, byCategory, settings }
}

export default async function RestaurantPage() {
  const { food, drinks, byCategory, settings } = await getData()

  const Section = ({ cats, title, icon }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 'clamp(32px,4vw,52px)' }}>
        <span style={{ font: '400 36px Cormorant Garamond,serif' }}>{icon}</span>
        <h2 style={{ font: '400 clamp(28px,4vw,48px)/1.05 Cormorant Garamond,serif', color: '#1C1917', margin: 0 }}>{title}</h2>
      </div>
      {cats.map((cat, ci) => {
        const items = byCategory[cat.id] ?? []
        if (!items.length) return null
        return (
          <div key={cat.id} id={cat.slug} style={{ marginBottom: 'clamp(40px,5vw,64px)', scrollMarginTop: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <h3 style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#3B5249', margin: 0 }}>{cat.name}</h3>
              <div style={{ flex: 1, height: 1, background: '#E5E0D8' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {items.map((item, ii) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '14px 0', borderBottom: ii < items.length - 1 ? '1px solid #F0ECE6' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: '600 15px/1.2 Inter,sans-serif', color: '#1C1917' }}>{item.name}</span>
                      {item.is_recommended && <span style={{ background: '#C4924A', color: '#fff', padding: '2px 8px', borderRadius: 999, font: '600 9px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>Chef&apos;s Pick</span>}
                      {item.badge && item.badge.split(' ').map(b => (
                        <span key={b} style={{ background: '#E8EDE9', color: '#3B5249', padding: '2px 8px', borderRadius: 999, font: '600 9px Inter,sans-serif', letterSpacing: 1 }}>{b}</span>
                      ))}
                    </div>
                    {item.description && <p style={{ font: '400 13px/1.55 Inter,sans-serif', color: '#9B9390', margin: '4px 0 0' }}>{item.description}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.price && <div style={{ font: '400 17px Cormorant Garamond,serif', color: '#1C1917', whiteSpace: 'nowrap' }}>฿{item.price}</div>}
                    {item.price_note && <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390', marginTop: 2 }}>{item.price_note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  const restaurantSchema = jsonLdScript({
    '@context':     'https://schema.org',
    '@type':        'Restaurant',
    name:           'Ton Mai Spa Garden Restaurant',
    url:            'https://www.tonmaispa.com/restaurant',
    telephone:      '+66631175211',
    address: {
      '@type':          'PostalAddress',
      streetAddress:    '6/11 Moo 2 Wiset Road',
      addressLocality:  'Rawai',
      addressRegion:    'Phuket',
      postalCode:       '83130',
      addressCountry:   'TH',
    },
    servesCuisine:  ['Thai', 'International', 'Healthy'],
    openingHours:   'Mo-Su 09:00-23:00',
    priceRange:     '฿฿',
    hasMenu:        'https://www.tonmaispa.com/restaurant',
    image:          'https://www.tonmaispa.com/og-image.jpg',
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: restaurantSchema }} />
      <Nav />

      {/* Page hero */}
      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32, alignItems: 'end' }}>
          <div>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Garden Restaurant</div>
            <h1 style={{ font: '400 clamp(38px,7vw,72px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>The Menu</h1>
            <p style={{ font: '400 clamp(14px,1.2vw,17px)/1.7 Inter,sans-serif', color: 'rgba(255,255,255,0.8)', margin: '16px 0 0', maxWidth: '48ch' }}>
              Thai classics, healthy international dishes and fresh garden drinks — served all day in our open-air sala overlooking the palms.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '14px 18px' }}>
              <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff' }}>09:00–23:00</div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Open Daily</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '14px 18px' }}>
              <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff' }}>Garden Dining</div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Open-Air Salas</div>
            </div>
          </div>
        </div>

        {/* Quick-jump category links */}
        <div style={{ maxWidth: 1200, margin: '28px auto 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...food, ...drinks].map(cat => (
            <a key={cat.id} href={`#${cat.slug}`} style={{ padding: '7px 14px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
              {cat.name}
            </a>
          ))}
        </div>
      </section>

      <main style={{ padding: 'clamp(56px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          <Section cats={food}   title="Food"   icon="🌿" />

          <div style={{ borderTop: '1px solid #E5E0D8', margin: 'clamp(40px,5vw,64px) 0' }} />

          <Section cats={drinks} title="Drinks" icon="🍹" />

          <div style={{ marginTop: 'clamp(40px,5vw,64px)', background: '#E8EDE9', borderRadius: 8, padding: 'clamp(24px,3vw,40px)', textAlign: 'center' }}>
            <p style={{ font: '400 14px/1.7 Inter,sans-serif', color: '#6B6663', margin: 0 }}>
              All prices include VAT. Allergen information available on request — please inform your server of any dietary requirements. Menu items change seasonally.
            </p>
          </div>
        </div>
      </main>

      <Footer settings={settings} />
    </>
  )
}
