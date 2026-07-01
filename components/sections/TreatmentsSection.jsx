import Image from 'next/image'
import TrackedLink from '@/components/ui/TrackedLink'

export default function TreatmentsSection({ treatments = [] }) {
  const featured = treatments.slice(0, 3)

  const placeholders = [
    { name: 'Traditional Thai Massage', category: 'massage', description: 'Deep rhythmic pressure along energy lines, releasing tension from feet to crown.', prices: [{ duration: 60, thb: 600 }, { duration: 90, thb: 850 }, { duration: 120, thb: 1100 }], badge: 'Most Popular', img: '/assets/massage-2.jpg' },
    { name: 'Outdoor Massage',          category: 'massage', description: 'All the benefits of Thai massage in an open-air sala overlooking the garden.', prices: [{ duration: 60, thb: 700 }, { duration: 90, thb: 950 }], badge: 'Garden Experience', img: '/assets/outdoor-massage.jpg' },
    { name: 'Body Scrub & Wrap',        category: 'body',    description: 'Turmeric-salt exfoliation followed by a coconut milk wrap for radiant, silky skin.', prices: [{ duration: 90, thb: 950 }], badge: '', img: '/assets/body-scrub.jpg' },
  ]

  const items = featured.length >= 3 ? featured : placeholders
  const tags  = ['Thai Massage','Deep Tissue','Aromatherapy','Foot Reflexology','Facial','Body Scrub','Hot Stone','Herbal Ball','Prenatal']

  return (
    <section id="treatments" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#E8EDE9' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', textAlign: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#3B5249' }}>Services</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
            Every treatment, unhurried.
          </h2>
          <p style={{ font: '400 clamp(14px,1.1vw,16px)/1.7 Inter,sans-serif', color: '#6B6663', marginTop: 14, maxWidth: '52ch', marginLeft: 'auto', marginRight: 'auto' }}>
            Choose from traditional Thai massage, facials, scrubs and specialty treatments — all performed by skilled Thai therapists in an open garden setting.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
            {tags.map(t => (
              <span key={t} style={{ padding: '6px 14px', border: '1px solid #3B5249', borderRadius: 999, font: '400 12px Inter,sans-serif', color: '#3B5249', letterSpacing: 0.5 }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {items.map((t, i) => {
            const img   = t.cloudinary_url ?? t.img ?? `/assets/massage-${i+1}.jpg`
            const price = Array.isArray(t.prices) ? t.prices[0]?.thb : null
            const badge = t.badge
            return (
              <div key={t.id ?? t.name} data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: `opacity .8s ${i*0.12}s ease, transform .8s ${i*0.12}s ease`, background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,25,23,0.07)' }}>
                <div style={{ position: 'relative', height: 220 }}>
                  <Image src={img} alt={t.name} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
                  {badge && <div style={{ position: 'absolute', top: 14, left: 14, background: '#C4924A', color: '#fff', padding: '5px 12px', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>{badge}</div>}
                </div>
                <div style={{ padding: '24px 26px' }}>
                  <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#3B5249' }}>{t.category ?? 'massage'}</div>
                  <h3 style={{ font: '400 22px/1.1 Cormorant Garamond,serif', color: '#1C1917', margin: '8px 0 0' }}>{t.name}</h3>
                  <p style={{ font: '400 14px/1.65 Inter,sans-serif', color: '#6B6663', margin: '10px 0 0' }}>{t.description}</p>
                  {price && <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#9B9390' }}>From</div>
                      <div style={{ font: '400 24px Cormorant Garamond,serif', color: '#1C1917' }}>฿{price}</div>
                    </div>
                    <TrackedLink href="#contact" event="book_now_click" params={{ method: 'treatment_card', treatment: t.name }} style={{ background: '#3B5249', color: '#fff', padding: '10px 18px', borderRadius: 2, font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase' }}>Book</TrackedLink>
                  </div>}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a href="/spa-menu" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6 }}>
            View Full Menu →
          </a>
        </div>
      </div>
    </section>
  )
}
