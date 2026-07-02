import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title:       'Privacy Policy — Ton Mai Spa',
  description: 'How Ton Mai Spa collects and uses your personal information, in line with Thailand’s PDPA and the GDPR.',
}

const prose = { font: '400 clamp(14px,1.1vw,16px)/1.8 Inter,sans-serif', color: '#4A4542', margin: '0 0 18px' }
const h2st  = { font: '400 clamp(20px,2.5vw,28px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: '40px 0 14px' }
const h3st  = { font: '600 12px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#3B5249', margin: '28px 0 10px' }
const list  = { ...prose, paddingLeft: 22 }
const li    = { marginBottom: 8 }
const table = { width: '100%', borderCollapse: 'collapse', margin: '0 0 18px' }
const th    = { textAlign: 'left', font: '600 11px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', padding: '8px 12px 8px 0', borderBottom: '1px solid #E0D9D0' }
const td    = { font: '400 14px/1.6 Inter,sans-serif', color: '#4A4542', padding: '10px 12px 10px 0', borderBottom: '1px solid #F0ECE6', verticalAlign: 'top' }

export default function PrivacyPage() {
  return (
    <>
      <Nav />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Legal</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>Privacy Policy</h1>
          <p style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Last updated: 2 July 2026</p>
        </div>
      </section>

      <main style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <h2 style={{ ...h2st, margin: '0 0 14px' }}>1. Introduction</h2>
          <p style={prose}>
            Ton Mai Spa (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), located at 6/11 Moo 2 Wiset Road, Tambon Rawai, Phuket 83130, Thailand, operates the website tonmaispa.com and the spa and restaurant it describes. This policy explains what personal data we collect when you visit our site, book a treatment, or contact us, why we collect it, who we share it with, and the rights available to you.
          </p>
          <p style={prose}>
            We are the <strong>data controller</strong> for information collected through this website. This policy is designed to address the requirements of Thailand&apos;s Personal Data Protection Act B.E. 2562 (PDPA) — the law that governs us as a Thailand-based business — and, for visitors in the European Economic Area, the UK, or Switzerland, the General Data Protection Regulation (GDPR).
          </p>

          <h2 style={h2st}>2. Information We Collect</h2>
          <h3 style={h3st}>Information you provide directly</h3>
          <p style={prose}>When you submit a booking or enquiry, message our chatbot, or contact us through the site, we may collect: your name, phone number, email address (optional), preferred treatment and date, party size, and any notes you choose to include (for example, allergies or preferences you mention to our chatbot).</p>
          <h3 style={h3st}>Information collected automatically</h3>
          <p style={prose}>With your consent, given through the cookie banner on your first visit, we use Google Analytics 4 to understand how visitors use our website — pages visited, approximate location from IP address, browser type, and time spent on the site. This data is aggregated and is not used to identify you personally. No analytics cookie is set unless you actively accept it; see &ldquo;Cookies&rdquo; below.</p>
          <p style={prose}>Our hosting and security providers (Vercel, Cloudflare, Upstash) automatically log technical data such as IP address and request timestamps for the limited purposes of running the site, rate-limiting abusive traffic, and detecting bots on our forms.</p>

          <h2 style={h2st}>3. How We Use Your Information</h2>
          <p style={prose}>We use the information you provide to:</p>
          <ul style={list}>
            <li style={li}>Respond to your booking requests and enquiries, and confirm bookings by email and WhatsApp/Line</li>
            <li style={li}>Operate our AI chatbot, which uses your messages to answer questions and help you book</li>
            <li style={li}>Maintain records required for tax and business-accounting compliance under Thai law</li>
            <li style={li}>Detect and prevent spam or abuse of our booking and enquiry forms</li>
            <li style={li}>Understand and improve our website, only where you have consented to analytics cookies</li>
          </ul>
          <p style={prose}>We do not sell, rent, or share your personal information with third parties for their own marketing purposes, and we do not use advertising or cross-site tracking cookies.</p>

          <h2 style={h2st}>4. Who We Share Your Information With</h2>
          <p style={prose}>We use the following sub-processors to run our website and business. Each only receives the data it needs to perform its function:</p>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Service</th>
                <th style={th}>Purpose</th>
                <th style={th}>Data involved</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={td}><strong>Supabase</strong></td><td style={td}>Database hosting</td><td style={td}>Bookings, enquiries, chat history, cookie consent log</td></tr>
              <tr><td style={td}><strong>Brevo</strong></td><td style={td}>Transactional email</td><td style={td}>Name, email, booking details (for confirmation emails only)</td></tr>
              <tr><td style={td}><strong>Cloudinary</strong></td><td style={td}>Image hosting</td><td style={td}>Photos of the spa and treatments — no personal guest data</td></tr>
              <tr><td style={td}><strong>Cloudflare Turnstile</strong></td><td style={td}>Bot / spam protection</td><td style={td}>Browser signals used to verify you&apos;re human; no personal profile is built</td></tr>
              <tr><td style={td}><strong>Upstash</strong></td><td style={td}>Rate limiting</td><td style={td}>IP address, used only to count requests and prevent abuse</td></tr>
              <tr><td style={td}><strong>MiniMax</strong></td><td style={td}>AI chatbot replies</td><td style={td}>Your chat messages, sent to generate a response</td></tr>
              <tr><td style={td}><strong>Google Analytics 4</strong></td><td style={td}>Website analytics</td><td style={td}>Only active after cookie consent — see &ldquo;Cookies&rdquo;</td></tr>
              <tr><td style={td}><strong>Vercel</strong></td><td style={td}>Website hosting</td><td style={td}>Standard server logs; also provides Vercel Analytics/Speed Insights</td></tr>
              <tr><td style={td}><strong>WhatsApp / Line</strong></td><td style={td}>Guest messaging</td><td style={td}>Conversations you choose to have with us on these platforms, governed by their own privacy policies</td></tr>
            </tbody>
          </table>
          <p style={prose}>We may also disclose personal data where required by Thai law, court order, or to protect the rights, property, or safety of Ton Mai Spa, our guests, or the public.</p>

          <h2 style={h2st}>5. International Data Transfers</h2>
          <p style={prose}>Several of the services above (including Supabase, Brevo, Cloudinary, Cloudflare, Upstash, MiniMax, Google, and Vercel) process data on servers located outside Thailand, including in the United States and the European Union. Where we transfer personal data internationally, we rely on the standard contractual and security safeguards these providers make available to their customers, consistent with PDPA Section 28&ndash;29 requirements for cross-border transfer and, for EEA visitors, the GDPR&apos;s transfer mechanisms.</p>

          <h2 style={h2st}>6. Data Retention</h2>
          <p style={prose}>We keep personal data only as long as needed for the purposes described in this policy:</p>
          <ul style={list}>
            <li style={li}><strong>Booking and enquiry records</strong> — up to 24 months, for guest service and Thai tax/accounting compliance, unless you ask us to delete them sooner.</li>
            <li style={li}><strong>Chat history</strong> — retained alongside your booking/enquiry record for the same period, to give context if you contact us again.</li>
            <li style={li}><strong>Cookie consent log</strong> — up to 24 months. This record contains only a randomly generated ID, a hashed IP address, your category choices, and a timestamp &mdash; never your name or contact details.</li>
          </ul>

          <h2 style={h2st}>7. Your Rights</h2>
          <h3 style={h3st}>If you are in Thailand (PDPA)</h3>
          <p style={prose}>Under Sections 30&ndash;36 of the PDPA, you have the right to: request access to and a copy of your personal data; request correction of inaccurate data; request deletion, suspension, or anonymisation of your data; object to or restrict our processing; and withdraw consent at any time (which does not affect processing carried out before withdrawal). You also have the right to lodge a complaint with Thailand&apos;s Personal Data Protection Committee.</p>
          <h3 style={h3st}>If you are in the EEA, UK, or Switzerland (GDPR)</h3>
          <p style={prose}>You have the same core rights as above, described in GDPR terms as the right to access, rectification, erasure, restriction of processing, data portability, and objection. Where we rely on your consent (such as analytics cookies), you may withdraw it at any time without affecting the lawfulness of processing before withdrawal. You also have the right to lodge a complaint with your local data protection authority.</p>
          <p style={prose}>To exercise any of these rights, contact us using the details in Section 11. We will respond within the timeframe required by applicable law (30 days under PDPA).</p>

          <h2 style={h2st}>8. Cookies</h2>
          <p style={prose}>When you first visit our site, a banner asks you to choose which cookies to allow. We use two categories:</p>
          <ul style={list}>
            <li style={li}><strong>Necessary</strong> — required for the site to work (remembering your cookie choice, session security). These are always on and don&apos;t require consent, as they&apos;re strictly necessary to provide the service you&apos;ve requested.</li>
            <li style={li}><strong>Analytics</strong> (Google Analytics) — only set if you click &ldquo;Accept All&rdquo; or enable it under &ldquo;Customize.&rdquo; Nothing is set if you click &ldquo;Reject Non-Essential.&rdquo;</li>
          </ul>
          <p style={prose}>We do not use advertising or marketing cookies. You can change your choice at any time via the &ldquo;Cookie Settings&rdquo; link in the footer of every page, or by clearing your browser&apos;s site data. See Section 6 for how long we keep the record of your decision.</p>

          <h2 style={h2st}>9. Children&apos;s Privacy</h2>
          <p style={prose}>Our website and spa services are directed at adults. Our thermal circuit (steam, sauna, cold plunge, pool) has a minimum age of 16, and spa treatments have a minimum age of 12, both requiring adult supervision where applicable and as posted at the spa. We do not knowingly collect personal data from children, and we do not offer services to unaccompanied minors. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>

          <h2 style={h2st}>10. Security</h2>
          <p style={prose}>We use industry-standard measures to protect your data, including encrypted connections (HTTPS/TLS) between your browser and our servers and database, role-based access controls limiting staff access to the information needed for their role, and reputable, security-audited infrastructure providers (Supabase, Vercel, Cloudflare) for hosting and storage. No method of transmission or storage is 100% secure; if we become aware of a data breach affecting your personal information, we will notify affected individuals and the relevant authority as required by the PDPA and, where applicable, the GDPR.</p>

          <h2 style={h2st}>11. Changes to This Policy</h2>
          <p style={prose}>We may update this policy from time to time as our services or legal obligations change. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision. If a change is significant — for example, a new category of data or a new third-party processor — we will highlight it on this page or, where required by law, seek renewed consent.</p>

          <h2 style={h2st}>12. Contact</h2>
          <p style={prose}>For any privacy-related questions, requests, or complaints, contact us at:</p>
          <p style={{ ...prose, color: '#3B5249' }}>
            Ton Mai Spa<br />
            6/11 Moo 2 Wiset Road, Tambon Rawai, Phuket 83130, Thailand<br />
            WhatsApp: +66 63 117 5211<br />
            Line: @tonmaispa
          </p>

        </div>
      </main>

      <Footer />
    </>
  )
}
