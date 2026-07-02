import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title:       'Terms & Conditions — Ton Mai Spa',
  description: 'Booking policy, cancellation terms, and website terms of use at Ton Mai Spa, Rawai Phuket.',
}

const prose = { font: '400 clamp(14px,1.1vw,16px)/1.8 Inter,sans-serif', color: '#4A4542', margin: '0 0 18px' }
const h2st  = { font: '400 clamp(20px,2.5vw,28px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: '40px 0 14px' }
const list  = { ...prose, paddingLeft: 22 }
const li    = { marginBottom: 10 }

export default function TermsPage() {
  return (
    <>
      <Nav />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Legal</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>Terms &amp; Conditions</h1>
          <p style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Last updated: 2 July 2026</p>
        </div>
      </section>

      <main style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <h2 style={{ ...h2st, margin: '0 0 14px' }}>1. Agreement to Terms</h2>
          <p style={prose}>These Terms &amp; Conditions govern your use of the tonmaispa.com website and your visit to Ton Mai Spa at 6/11 Moo 2 Wiset Road, Tambon Rawai, Phuket 83130, Thailand. By browsing our website, submitting a booking or enquiry, using our chatbot, or visiting the spa, you agree to these terms. If you do not agree, please do not use our website or services.</p>

          <h2 style={h2st}>2. Description of Service</h2>
          <p style={prose}>Ton Mai Spa offers Thai massage and spa treatments, a thermal circuit (herbal steam room, sauna, cold plunge pool, swimming pool and jacuzzi), and an open-air garden restaurant, open daily 09:00&ndash;23:00. Our website provides information about these services and lets you send a booking request or enquiry, either through a live booking form or a simple WhatsApp/Line message, and to chat with an AI assistant about treatments, prices, and availability.</p>

          <h2 style={h2st}>3. Bookings &amp; Reservations</h2>
          <p style={prose}>All treatments can be booked online via our website, by WhatsApp (+66 63 117 5211), Line (@tonmaispa), or by visiting the spa in person. Submitting a request through our website or chatbot is a request to book, not an automatic guarantee &mdash; a booking is confirmed once you receive a confirmation message or reference code from our team. Walk-ins are welcome subject to therapist availability.</p>

          <h2 style={h2st}>4. Cancellation &amp; Rescheduling</h2>
          <p style={prose}>We understand that plans change. Our cancellation policy is:</p>
          <ul style={list}>
            <li style={li}><strong>More than 48 hours before your appointment:</strong> full refund or free reschedule, no charge</li>
            <li style={li}><strong>24&ndash;48 hours before your appointment:</strong> 50% charge applies</li>
            <li style={li}><strong>Less than 24 hours / no-show:</strong> full treatment fee applies</li>
          </ul>
          <p style={prose}>To cancel or reschedule, please contact us by WhatsApp or Line at least 48 hours in advance.</p>

          <h2 style={h2st}>5. Arrival &amp; Late Arrival</h2>
          <p style={prose}>Please arrive at least 10 minutes before your scheduled appointment to complete a brief consultation and to change if required. Guests arriving late may receive a shortened treatment to avoid disruption for the next booking, with no adjustment to the original price.</p>

          <h2 style={h2st}>6. Health &amp; Medical Conditions</h2>
          <p style={prose}>Please inform our staff of any medical conditions, injuries, allergies, skin conditions, or pregnancy before your treatment. Certain treatments may not be suitable for guests with specific health conditions, and it is your responsibility to disclose relevant health information so our therapists can advise you safely. Our therapists reserve the right to modify or decline a treatment in the interest of guest safety.</p>
          <p style={prose}>The thermal circuit (steam, sauna, cold plunge) is not recommended for guests who are pregnant, have cardiovascular conditions, uncontrolled high blood pressure, or any condition made worse by extreme heat or cold. When in doubt, consult your physician before visiting. Neither our website content nor our AI chatbot provides medical advice &mdash; see Section 13.</p>

          <h2 style={h2st}>7. Age Policy</h2>
          <p style={prose}>Guests using the sauna and thermal facilities must be aged 16 or above. The swimming pool is open to all ages under appropriate adult supervision. Treatments are available for guests aged 12 and above; guests under 18 require parental consent.</p>

          <h2 style={h2st}>8. Spa Etiquette</h2>
          <ul style={list}>
            <li style={li}>Please speak softly and respect the tranquillity of other guests</li>
            <li style={li}>Mobile phones should be on silent in all treatment and relaxation areas</li>
            <li style={li}>Swimwear is required in all pool, cold plunge and outdoor thermal areas</li>
            <li style={li}>Lockers and changing rooms are provided &mdash; please secure your valuables</li>
            <li style={li}>Ton Mai Spa cannot be held responsible for loss or damage to personal belongings</li>
            <li style={li}>Please shower before entering the pool and thermal facilities</li>
          </ul>

          <h2 style={h2st}>9. Sauna Day Pass</h2>
          <p style={prose}>The Sauna Day Pass (฿200 per person) grants unlimited access to the herbal steam room, Finnish sauna, cold plunge pool, swimming pool and jacuzzi for the full operating day (09:00&ndash;23:00). The day pass does not include meals, beverages or spa treatments unless specifically stated. The pass is non-transferable and valid for one person on the purchased date only.</p>

          <h2 style={h2st}>10. Payments &amp; Prices</h2>
          <p style={prose}>All prices are in Thai Baht (THB) and include applicable taxes. Payment is taken in person at the spa &mdash; we do not process payments through this website. We accept cash (THB), major credit and debit cards, and PromptPay. Prices are subject to change without notice; the price confirmed at the time of booking will be honoured.</p>

          <h2 style={h2st}>11. Photography</h2>
          <p style={prose}>Photography for personal use is welcome in the garden, pool and common areas. Please do not photograph other guests without their consent. Photography is not permitted inside treatment rooms or changing areas.</p>

          <h2 style={h2st}>12. Website Use</h2>
          <p style={prose}>You agree to use our website only for its intended purpose &mdash; learning about our services and making genuine booking requests or enquiries. You agree not to: submit false or fraudulent booking requests; attempt to interfere with, disrupt, or gain unauthorised access to our website, database, or dashboard; use automated tools to scrape or overload our site; or use our contact forms or chatbot to send spam, abusive content, or unlawful material. We may block access or refuse service to anyone who misuses the site.</p>

          <h2 style={h2st}>13. AI Chatbot</h2>
          <p style={prose}>Our website includes an AI-powered chatbot that can answer questions about treatments, pricing, and availability, and may help you start a booking. Responses are generated automatically and, while we aim for accuracy, may occasionally be incomplete, out of date, or incorrect &mdash; always confirm booking details, prices, and treatment suitability with our staff directly, especially where health conditions are involved. The chatbot does not provide medical, health, or professional advice, and nothing it says overrides Section 6 (Health &amp; Medical Conditions) or the advice of a qualified physician.</p>

          <h2 style={h2st}>14. Intellectual Property</h2>
          <p style={prose}>All content on this website &mdash; including text, photographs, logos, and design &mdash; is owned by Ton Mai Spa or used with permission, and is protected by copyright and trademark law. You may view and share our content for personal, non-commercial purposes (for example, sharing a link with a friend), but you may not reproduce, modify, or use our content commercially without our written permission.</p>

          <h2 style={h2st}>15. Disclaimers &amp; Limitation of Liability</h2>
          <p style={prose}>Our website and its content are provided &ldquo;as is,&rdquo; without warranties of any kind, to the fullest extent permitted by Thai law. We do not guarantee that the website will be uninterrupted, error-free, or that booking availability shown online is always accurate in real time.</p>
          <p style={prose}>To the fullest extent permitted by law, Ton Mai Spa&apos;s total liability for any claim arising from your use of the website or our services is limited to the amount you paid for the specific service giving rise to the claim. We are not liable for indirect, incidental, or consequential damages. Nothing in these terms limits liability that cannot lawfully be limited, such as liability for death or personal injury caused by our negligence.</p>

          <h2 style={h2st}>16. Indemnification</h2>
          <p style={prose}>You agree to indemnify and hold Ton Mai Spa harmless from any claims, damages, or expenses (including reasonable legal fees) arising from your misuse of the website, your breach of these terms, or your violation of any law or the rights of a third party.</p>

          <h2 style={h2st}>17. Governing Law &amp; Dispute Resolution</h2>
          <p style={prose}>These terms are governed by the laws of the Kingdom of Thailand. Any dispute arising from these terms or your use of our website or services shall first be addressed by contacting us directly (Section 19) so we can attempt to resolve it informally. If not resolved, disputes shall be subject to the exclusive jurisdiction of the courts of Phuket Province, Thailand.</p>

          <h2 style={h2st}>18. Changes to These Terms</h2>
          <p style={prose}>We may update these terms from time to time to reflect changes in our services or legal requirements. The &ldquo;Last updated&rdquo; date at the top of this page shows the most recent revision. Continuing to use our website or services after an update means you accept the revised terms.</p>

          <h2 style={h2st}>19. Contact</h2>
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
