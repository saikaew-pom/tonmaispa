'use client'

const REVIEWS = [
  { name: 'Sophie L.',      flag: '🇬🇧', text: 'The most beautiful spa garden I have found in Phuket. The circuit — steam, sauna, cold plunge — is incredibly restorative. Unhurried, quiet, genuine.', stars: 5, date: 'June 2025' },
  { name: 'Piotr W.',       flag: '🇵🇱', text: 'Excellent Thai massage by a skilled therapist. The open-air sala in the garden is a magical setting. Came back three times in one week!', stars: 5, date: 'May 2025' },
  { name: 'Ananya R.',      flag: '🇹🇭', text: 'ดีมากๆ ค่ะ สถานที่ร่มรื่น บรรยากาศดี นวดแรงพอดี สุดประทับใจ จะกลับมาอีกแน่ๆ', stars: 5, date: 'April 2025' },
]

export default function ReviewsSection({ settings = {} }) {
  const rating      = settings['settings.google_rating']       ?? '4.8'
  const reviewCount = settings['settings.google_review_count'] ?? '369'

  return (
    <section id="reviews" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#E8EDE9' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'clamp(28px,4vw,56px)', alignItems: 'center', marginBottom: 'clamp(40px,5vw,56px)' }}>
          <div>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Reviews</div>
            <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '12px 0 0' }}>
              What guests say.
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 'clamp(20px,3vw,40px)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: '400 56px/1 Cormorant Garamond,serif', color: '#3B5249' }}>{rating}</div>
              <div style={{ color: '#C4924A', fontSize: 18, marginTop: 4 }}>{'★'.repeat(5)}</div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#9B9390', marginTop: 6 }}>Google Rating</div>
            </div>
            <div style={{ width: 1, height: 60, background: 'rgba(59,82,73,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: '400 56px/1 Cormorant Garamond,serif', color: '#3B5249' }}>{reviewCount}+</div>
              <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#9B9390', marginTop: 10 }}>Verified Reviews</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
          {REVIEWS.map((r, i) => (
            <div key={r.name} data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: `opacity .8s ${i*0.1}s ease, transform .8s ${i*0.1}s ease`, background: '#fff', borderRadius: 8, padding: 'clamp(22px,2vw,32px)', boxShadow: '0 2px 16px rgba(28,25,23,0.06)' }}>
              <div style={{ color: '#C4924A', fontSize: 16, letterSpacing: 2 }}>{'★'.repeat(r.stars)}</div>
              <p style={{ font: '400 italic clamp(14px,1.1vw,16px)/1.7 Cormorant Garamond,serif', color: '#1C1917', margin: '14px 0 0' }}>&ldquo;{r.text}&rdquo;</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <div style={{ font: '600 13px Inter,sans-serif', color: '#3B5249' }}>{r.flag} {r.name}</div>
                <div style={{ font: '400 12px Inter,sans-serif', color: '#9B9390' }}>{r.date}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="https://www.google.com/maps/search/?api=1&query=Ton+Mai+Spa+Rawai+Phuket" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6 }}
            onClick={() => { if (window.gtag) window.gtag('event','review_click') }}>
            Read All Reviews on Google →
          </a>
        </div>
      </div>
    </section>
  )
}
