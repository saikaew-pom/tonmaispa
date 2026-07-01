'use client'

export default function PricingSection({ settings = {} }) {
  const dayPass = settings['settings.day_pass_price']    ?? '200'
  const iceBath = settings['settings.ice_bath_price']    ?? '100'
  const wa      = settings['settings.whatsapp_number']   ?? '66631175211'
  const waMsg   = encodeURIComponent('Hi, I\'d like to enquire about the day pass at Ton Mai Spa')

  return (
    <section id="pricing" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#1C1917' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity .8s ease, transform .8s ease', textAlign: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Pricing</div>
          <h2 style={{ font: '400 clamp(30px,4.5vw,52px)/1.08 Cormorant Garamond,serif', color: '#fff', margin: '12px 0 0' }}>
            Simple, inclusive pricing.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>

          {/* Day Pass */}
          <div data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: 'opacity .8s ease, transform .8s ease', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 'clamp(28px,3vw,44px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Thermal Circuit</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '16px 0 0' }}>
              <span style={{ font: '400 58px/1 Cormorant Garamond,serif', color: '#fff' }}>฿{dayPass}</span>
              <span style={{ font: '400 16px Inter,sans-serif', color: 'rgba(255,255,255,0.5)' }}>/person</span>
            </div>
            <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff', margin: '4px 0 0' }}>Sauna Day Pass</div>
            <ul style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Full day herbal steam room access','Finnish sauna (unlimited rounds)','Cold plunge pool','Swimming pool & jacuzzi','Herbal welcome tea','Locker & towel','Garden lounge access'].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, font: '400 14px/1.5 Inter,sans-serif', color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ color: '#C4924A', flexShrink: 0 }}>✓</span>{item}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto', paddingTop: 28 }}>
              <a href="#contact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 50, background: '#C4924A', color: '#fff', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase' }}
                onClick={() => { if (window.gtag) window.gtag('event','book_now_click',{method:'pricing_day_pass'}) }}>
                Book Now
              </a>
            </div>
          </div>

          {/* Ice Bath Add-on */}
          <div data-reveal style={{ opacity: 0, transform: 'translateY(28px)', transition: 'opacity .8s .1s ease, transform .8s .1s ease', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 'clamp(28px,3vw,44px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Add-on</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '16px 0 0' }}>
              <span style={{ font: '400 58px/1 Cormorant Garamond,serif', color: '#fff' }}>฿{iceBath}</span>
              <span style={{ font: '400 16px Inter,sans-serif', color: 'rgba(255,255,255,0.5)' }}>/session</span>
            </div>
            <div style={{ font: '400 22px Cormorant Garamond,serif', color: '#fff', margin: '4px 0 0' }}>Ice Bath</div>
            <ul style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Private ice bath tub','Fresh ice filled before each session','Available with or without day pass','Guided breathing tips on arrival','Towel &amp; robe provided'].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, font: '400 14px/1.5 Inter,sans-serif', color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ color: '#C4924A', flexShrink: 0 }}>✓</span><span dangerouslySetInnerHTML={{ __html: item }} />
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto', paddingTop: 28 }}>
              <a
                href={`https://wa.me/${wa}?text=${waMsg}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 50, background: '#25D366', color: '#fff', borderRadius: 2, font: '600 11px Inter,sans-serif', letterSpacing: '2.5px', textTransform: 'uppercase' }}
                onClick={() => { if (window.gtag) window.gtag('event','whatsapp_click',{method:'pricing_ice_bath'}) }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Enquire on WhatsApp
              </a>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', font: '400 13px Inter,sans-serif', color: 'rgba(255,255,255,0.4)', marginTop: 28 }}>
          Massage &amp; spa treatments priced separately. See full menu for details.
        </p>
      </div>
    </section>
  )
}
