import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title:       'Terms & Conditions — Ton Mai Spa',
  description: 'Booking policy, cancellation terms and spa house rules at Ton Mai Spa, Rawai Phuket.',
}

const prose = { font: '400 clamp(14px,1.1vw,16px)/1.8 Inter,sans-serif', color: '#4A4542', margin: '0 0 18px' }
const h2st  = { font: '400 clamp(20px,2.5vw,28px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: '40px 0 14px' }

export default function TermsPage() {
  return (
    <>
      <Nav />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Legal</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>Terms &amp; Conditions</h1>
          <p style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Last updated: 1 July 2026</p>
        </div>
      </section>

      <main style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <h2 style={h2st}>1. Bookings &amp; Reservations</h2>
          <p style={prose}>All treatments can be booked online via our website, by WhatsApp (+66 63 117 5211), Line (@tonmaispa), or by visiting the spa in person. A booking is confirmed once you receive a confirmation message or reference code from us. Walk-ins are welcome subject to therapist availability.</p>

          <h2 style={h2st}>2. Cancellation &amp; Rescheduling</h2>
          <p style={prose}>We understand that plans change. Our cancellation policy is:</p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 10 }}><strong>More than 48 hours before your appointment:</strong> full refund or free reschedule, no charge</li>
            <li style={{ marginBottom: 10 }}><strong>24–48 hours before your appointment:</strong> 50% charge applies</li>
            <li style={{ marginBottom: 10 }}><strong>Less than 24 hours / no-show:</strong> full treatment fee applies</li>
          </ul>
          <p style={prose}>To cancel or reschedule, please contact us by WhatsApp or Line at least 48 hours in advance.</p>

          <h2 style={h2st}>3. Arrival &amp; Late Arrival</h2>
          <p style={prose}>Please arrive at least 10 minutes before your scheduled appointment to complete a brief consultation and to change if required. Guests arriving late may receive a shortened treatment to avoid disruption for the next booking, with no adjustment to the original price.</p>

          <h2 style={h2st}>4. Health &amp; Medical Conditions</h2>
          <p style={prose}>Please inform our staff of any medical conditions, injuries, allergies or pregnancy before your treatment. Certain treatments may not be suitable for guests with specific health conditions. Our therapists reserve the right to modify or decline a treatment in the interest of guest safety.</p>
          <p style={prose}>The thermal circuit (steam, sauna, cold plunge) is not recommended for guests who are pregnant, have cardiovascular conditions, uncontrolled high blood pressure, or any condition made worse by extreme heat or cold. When in doubt, consult your physician before visiting.</p>

          <h2 style={h2st}>5. Age Policy</h2>
          <p style={prose}>Guests using the sauna and thermal facilities must be aged 16 or above. The swimming pool is open to all ages under appropriate adult supervision. Treatments are available for guests aged 12 and above; guests under 18 require parental consent.</p>

          <h2 style={h2st}>6. Spa Etiquette</h2>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>Please speak softly and respect the tranquillity of other guests</li>
            <li style={{ marginBottom: 8 }}>Mobile phones should be on silent in all treatment and relaxation areas</li>
            <li style={{ marginBottom: 8 }}>Swimwear is required in all pool, cold plunge and outdoor thermal areas</li>
            <li style={{ marginBottom: 8 }}>Lockers and changing rooms are provided — please secure your valuables</li>
            <li style={{ marginBottom: 8 }}>Ton Mai Spa cannot be held responsible for loss or damage to personal belongings</li>
            <li style={{ marginBottom: 8 }}>Please shower before entering the pool and thermal facilities</li>
          </ul>

          <h2 style={h2st}>7. Sauna Day Pass</h2>
          <p style={prose}>The Sauna Day Pass (฿200 per person) grants unlimited access to the herbal steam room, Finnish sauna, cold plunge pool, swimming pool and jacuzzi for the full operating day (09:00–23:00). The day pass does not include meals, beverages or spa treatments unless specifically stated. The pass is non-transferable and valid for one person on the purchased date only.</p>

          <h2 style={h2st}>8. Payments &amp; Prices</h2>
          <p style={prose}>All prices are in Thai Baht (THB) and include applicable taxes. We accept cash (THB), major credit and debit cards and PromptPay. Prices are subject to change without notice; the price confirmed at the time of booking will be honoured.</p>

          <h2 style={h2st}>9. Photography</h2>
          <p style={prose}>Photography for personal use is welcome in the garden, pool and common areas. Please do not photograph other guests without their consent. Photography is not permitted inside treatment rooms or changing areas.</p>

          <h2 style={h2st}>10. Governing Law</h2>
          <p style={prose}>These terms are governed by the laws of the Kingdom of Thailand. Any disputes shall be subject to the exclusive jurisdiction of the courts of Phuket Province, Thailand.</p>

          <h2 style={h2st}>11. Contact</h2>
          <p style={{ ...prose, color: '#3B5249' }}>
            Ton Mai Spa<br />
            6/11 Moo 2 Wiset Road, Rawai, Phuket 83130, Thailand<br />
            WhatsApp: +66 63 117 5211 · Line: @tonmaispa
          </p>

        </div>
      </main>

      <Footer />
    </>
  )
}
