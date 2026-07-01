import Nav    from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title:       'Privacy Policy — Ton Mai Spa',
  description: 'How Ton Mai Spa collects and uses your personal information.',
}

const prose = { font: '400 clamp(14px,1.1vw,16px)/1.8 Inter,sans-serif', color: '#4A4542', margin: '0 0 18px' }
const h2st  = { font: '400 clamp(20px,2.5vw,28px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: '40px 0 14px' }
const h3st  = { font: '600 12px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#3B5249', margin: '28px 0 10px' }

export default function PrivacyPage() {
  return (
    <>
      <Nav />

      <section style={{ background: '#3B5249', padding: 'clamp(100px,14vw,160px) clamp(18px,4vw,40px) clamp(48px,6vw,72px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Legal</div>
          <h1 style={{ font: '400 clamp(36px,6vw,64px)/1.05 Cormorant Garamond,serif', color: '#fff', margin: '14px 0 0' }}>Privacy Policy</h1>
          <p style={{ font: '400 14px Inter,sans-serif', color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Last updated: 1 July 2026</p>
        </div>
      </section>

      <main style={{ padding: 'clamp(48px,7vw,96px) clamp(18px,4vw,40px)', background: '#FAF6F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <p style={prose}>
            Ton Mai Spa (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), located at 6/11 Moo 2 Wiset Road, Rawai, Phuket 83130, Thailand, is committed to protecting the personal information of guests who visit our website or spa. This policy explains what data we collect, how we use it, and your rights under Thailand&apos;s Personal Data Protection Act B.E. 2562 (PDPA) and, for visitors in the European Economic Area, the General Data Protection Regulation (GDPR). Ton Mai Spa is the data controller for information collected through this website.
          </p>

          <h2 style={h2st}>Information We Collect</h2>
          <h3 style={h3st}>Information you provide directly</h3>
          <p style={prose}>When you submit an enquiry, make a booking, or contact us via our website, we may collect: your name, phone number, email address, preferred treatment and date, and any additional notes you choose to include.</p>
          <h3 style={h3st}>Information collected automatically</h3>
          <p style={prose}>With your consent (see &ldquo;Cookies&rdquo; below), we use Google Analytics 4 to understand how visitors use our website. This may include your IP address, browser type, pages visited and time spent on the site. This data is anonymised and aggregated — we cannot identify you individually from it. Analytics cookies are only set after you accept them in our cookie banner; you can withdraw consent at any time via the &ldquo;Cookie Settings&rdquo; link in the footer.</p>

          <h2 style={h2st}>How We Use Your Information</h2>
          <p style={prose}>We use the information you provide to:</p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>Respond to your booking requests and enquiries</li>
            <li style={{ marginBottom: 8 }}>Send booking confirmation emails and WhatsApp messages</li>
            <li style={{ marginBottom: 8 }}>Improve our services and website experience</li>
            <li style={{ marginBottom: 8 }}>Comply with legal obligations</li>
          </ul>
          <p style={prose}>We do not sell, rent or share your personal information with third parties for marketing purposes.</p>

          <h2 style={h2st}>Third-Party Services</h2>
          <p style={prose}>Our website uses the following third-party services that may process your data:</p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}><strong>Google Analytics</strong> — website usage analytics, only active if you consent (see &ldquo;Cookies&rdquo;)</li>
            <li style={{ marginBottom: 8 }}><strong>WhatsApp / Line</strong> — messaging platforms you use to contact us (subject to their own privacy policies)</li>
            <li style={{ marginBottom: 8 }}><strong>Supabase</strong> — secure cloud database for storing booking, enquiry, and cookie-consent records</li>
            <li style={{ marginBottom: 8 }}><strong>Cloudflare Turnstile</strong> — bot protection on our contact forms</li>
            <li style={{ marginBottom: 8 }}><strong>Brevo</strong> — email delivery service for booking confirmations</li>
          </ul>

          <h2 style={h2st}>Data Retention</h2>
          <p style={prose}>We retain booking and enquiry records for up to 24 months for business and tax compliance purposes. You may request earlier deletion at any time by contacting us.</p>

          <h2 style={h2st}>Your Rights</h2>
          <p style={prose}>You have the right to:</p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>Access the personal data we hold about you</li>
            <li style={{ marginBottom: 8 }}>Correct any inaccurate information</li>
            <li style={{ marginBottom: 8 }}>Request deletion of your data</li>
            <li style={{ marginBottom: 8 }}>Withdraw consent for communications at any time</li>
          </ul>

          <h2 style={h2st}>Cookies</h2>
          <p style={prose}>When you first visit our site, a banner asks you to choose which cookies to allow. We use two categories:</p>
          <ul style={{ ...prose, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}><strong>Necessary</strong> — required for the site to work (remembering your cookie choice, session security). These are always on and don&apos;t require consent, as they&apos;re strictly necessary to provide the service you&apos;ve requested.</li>
            <li style={{ marginBottom: 8 }}><strong>Analytics</strong> (Google Analytics) — only set if you click &ldquo;Accept All&rdquo; or enable it under &ldquo;Customize.&rdquo; Nothing is set if you click &ldquo;Reject Non-Essential.&rdquo;</li>
          </ul>
          <p style={prose}>We do not use advertising or marketing cookies. You can change your choice at any time via the &ldquo;Cookie Settings&rdquo; link in the footer of every page, or by clearing your browser&apos;s site data. We keep a record of each consent decision (your choice, a randomly generated ID, timestamp, and the policy version) for up to 24 months, as required to demonstrate compliance under PDPA Section 19 and GDPR Article 7(1) — we do not log your name or contact details alongside this record.</p>

          <h2 style={h2st}>Contact</h2>
          <p style={prose}>For any privacy-related questions or requests, contact us at:</p>
          <p style={{ ...prose, color: '#3B5249' }}>
            Ton Mai Spa<br />
            6/11 Moo 2 Wiset Road, Rawai, Phuket 83130, Thailand<br />
            WhatsApp: +66 63 117 5211<br />
            Line: @tonmaispa
          </p>

        </div>
      </main>

      <Footer />
    </>
  )
}
