import Image from 'next/image'
import TrackedLink from '@/components/ui/TrackedLink'

export default function AboutSection() {
  return (
    <section id="about" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: 'opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1)', maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'clamp(32px,5vw,72px)', alignItems: 'center' }}>

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', height: 'clamp(360px,46vw,560px)', borderRadius: 8, boxShadow: '0 20px 48px rgba(28,25,23,0.14)', overflow: 'hidden' }}>
            <Image
              src="/assets/garden.jpg"
              alt="Guest relaxing on a rattan daybed in the tropical garden at Ton Mai Spa, Rawai Phuket"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div style={{ position: 'absolute', bottom: -22, right: -12, background: '#fff', padding: '18px 24px', borderRadius: 4, boxShadow: '0 8px 24px rgba(28,25,23,0.12)', maxWidth: 200 }}>
            <div style={{ font: '400 32px Cormorant Garamond,serif', color: '#3B5249' }}>Ton Mai</div>
            <div style={{ font: '400 13px/1.5 Inter,sans-serif', color: '#6B6663', marginTop: 2 }}>&ldquo;The tree of life&rdquo; — our name &amp; our nature.</div>
          </div>
        </div>

        <div>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Our Philosophy</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#1C1917', margin: '14px 0 0', letterSpacing: '-0.3px' }}>
            Wellness grown from Thai tradition, not luxury for its own sake.
          </h2>
          <div style={{ width: 48, height: 2, background: '#3B5249', margin: '26px 0' }} />
          <p style={{ font: '400 clamp(15px,1.2vw,16px)/1.75 Inter,sans-serif', color: '#6B6663', margin: 0 }}>
            Tucked into a garden of bamboo, palm and tropical flowers in Rawai, Ton Mai Spa brings together the old rituals of Thai healing — herbal steam, deep heat, cold water and skilled, unhurried hands. Everything here is grounded, warm and genuine: teak wood, woven rattan, herbal tea in wicker baskets, and the quiet hum of the garden.
          </p>
          <p style={{ font: '400 clamp(15px,1.2vw,16px)/1.75 Inter,sans-serif', color: '#6B6663', margin: '18px 0 0' }}>
            Come for an hour or stay the afternoon. Move from steam to sauna to cold plunge, float in the pool, then drift into a massage beneath the palms.
          </p>
          <TrackedLink href="#contact" event="book_now_click" params={{ method: 'about_section' }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 30, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 6 }}>
            Plan Your Visit →
          </TrackedLink>
        </div>
      </div>
    </section>
  )
}
