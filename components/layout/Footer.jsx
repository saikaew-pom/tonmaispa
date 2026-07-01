import Image from 'next/image'
import TrackedLink from '@/components/ui/TrackedLink'

export default function Footer({ settings = {} }) {
  const wa   = settings['settings.whatsapp_number'] ?? '66631175211'
  const line = settings['settings.line_id']         ?? '@tonmaispa'
  const ig   = settings['settings.instagram_url']   ?? 'https://www.instagram.com/tonmai.spa/'
  const fb   = settings['settings.facebook_url']    ?? 'https://www.facebook.com/tonmai.spa'

  return (
    <footer style={{ background: '#1C1917', color: 'rgba(250,246,240,0.72)', padding: 'clamp(48px,6vw,80px) clamp(18px,4vw,40px) 36px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'clamp(28px,4vw,56px)' }}>

        <div>
          <Image src="/logo-white.png" alt="Ton Mai Spa" width={200} height={68} style={{ height: 68, width: 'auto', opacity: 0.9 }} />
          <p style={{ font: '400 13px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.55)', margin: '18px 0 0', maxWidth: '34ch' }}>
            A tropical garden of Thai healing in Rawai, Phuket. Steam, sauna, cold plunge, pool &amp; massage — open every day until late.
          </p>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>Explore</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
            {[['/spa-menu','Spa Menu'],['/restaurant','Restaurant'],['/book','Book Now'],['/#facilities','Facilities'],['/#pricing','Pricing']].map(([h,l]) => (
              <a key={h} href={h} style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>{l}</a>
            ))}
          </div>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>Visit</div>
          <div style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.72)', marginTop: 18 }}>
            6/11 Moo 2 Wiset Road,<br />Tambon Rawai, Phuket 83130<br />Thailand
          </div>
          <div style={{ font: '400 14px/1.7 Inter,sans-serif', color: 'rgba(250,246,240,0.72)', marginTop: 14 }}>
            Daily · 9am – 11pm<br />+66 63 117 5211
          </div>
        </div>

        <div>
          <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#D9AE72' }}>Connect</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
            <TrackedLink href={ig} event="instagram_click" params={{ source: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>Instagram</TrackedLink>
            <TrackedLink href={fb} event="facebook_click" params={{ source: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>Facebook</TrackedLink>
            <TrackedLink href={`https://wa.me/${wa}`} event="whatsapp_click" params={{ method: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>WhatsApp</TrackedLink>
            <TrackedLink href={`https://line.me/R/ti/p/${line}`} event="line_click" params={{ method: 'footer' }} target="_blank" rel="noopener noreferrer" style={{ font: '400 14px Inter,sans-serif', color: 'rgba(250,246,240,0.72)' }}>Line</TrackedLink>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: 'clamp(36px,5vw,56px) auto 0', paddingTop: 26, borderTop: '1px solid rgba(250,246,240,0.12)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', font: '400 12px Inter,sans-serif', color: 'rgba(250,246,240,0.45)' }}>
        <span>© {new Date().getFullYear()} Ton Mai Spa · Rawai, Phuket</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href="/privacy" style={{ color: 'rgba(250,246,240,0.45)' }}>Privacy</a>
          <a href="/terms"   style={{ color: 'rgba(250,246,240,0.45)' }}>Terms</a>
        </span>
      </div>
    </footer>
  )
}
