'use client'
import BookingCTA from '@/components/ui/BookingCTA'
import { t } from '@/lib/i18n/t'

export default function ContactSection({ settings = {}, dict = {} }) {
  const wa     = settings['settings.whatsapp_number'] ?? '66631175211'
  const lineId = settings['settings.line_id']         ?? '@tonmaispa'

  return (
    <section id="contact" style={{ padding: 'clamp(64px,10vw,128px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'clamp(40px,5vw,80px)', alignItems: 'start' }}>

        {/* Booking form / enquiry form */}
        <BookingCTA settings={settings} dict={dict} />

        {/* Location info + map */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#9B9390', marginBottom: 12 }}>{t(dict, 'home.contact.findUs')}</div>
            <p style={{ font: '400 15px/1.8 Inter,sans-serif', color: '#6B6663', margin: 0 }}>
              {t(dict, 'home.contact.addressLine1')}<br />
              {t(dict, 'home.contact.addressLine2')}<br />
              {t(dict, 'home.contact.addressLine3')}<br />
              <br />
              {t(dict, 'home.contact.openDaily')}
            </p>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=7.7794138,98.3285633&destination_place_id=0x305028b829ce03eb:0x8195de1e2fc2ad11"
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, font: '600 11px Inter,sans-serif', letterSpacing: 2, textTransform: 'uppercase', color: '#3B5249', borderBottom: '1.5px solid #C4924A', paddingBottom: 4 }}
              onClick={() => { if (window.gtag) window.gtag('event','map_click') }}
            >
              {t(dict, 'home.contact.getDirections')}
            </a>
          </div>

          {/* Google Maps embed */}
          <div style={{ borderRadius: 8, overflow: 'hidden', height: 'clamp(260px,30vw,380px)', boxShadow: '0 6px 24px rgba(28,25,23,0.1)' }}>
            <iframe
              title="Ton Mai Spa location — Rawai, Phuket"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3953.0!2d98.3285633!3d7.7794138!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x305028b829ce03eb%3A0x8195de1e2fc2ad11!2sTon%20Mai%20Spa%20%26%20Massage%20Rawai%20Phuket!5e0!3m2!1sen!2sth!4v1"
              width="100%" height="100%" style={{ border: 0 }}
              allowFullScreen loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Compact contact links */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 12px', background: '#25D366', color: '#fff', borderRadius: 2, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}
              onClick={() => { if (window.gtag) window.gtag('event','whatsapp_click',{method:'contact_map'}) }}>
              {t(dict, 'home.contact.whatsapp')}
            </a>
            <a href={`https://line.me/R/ti/p/${lineId}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '10px 12px', background: '#06C755', color: '#fff', borderRadius: 2, font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}
              onClick={() => { if (window.gtag) window.gtag('event','line_click',{method:'contact_map'}) }}>
              {t(dict, 'home.contact.line')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
