// Resend email helper
// Set RESEND_TEST_TO in dev to redirect all mail to your inbox.
// REMOVE RESEND_TEST_TO before going to production.
// Pass ignoreTestTo: true for invite emails — they must reach the real person.

export async function sendEmail({ to, subject, html, ignoreTestTo = false }) {
  const recipient = (process.env.RESEND_TEST_TO && !ignoreTestTo)
    ? process.env.RESEND_TEST_TO
    : to

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM ?? 'Ton Mai Spa <hello@tonmaispa.com>',
      to:      recipient,
      subject,
      html,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('[resend] send failed:', data)
    return { ok: false, error: data }
  }
  return { ok: true, id: data.id }
}

// ── Email templates ────────────────────────────────────────────

export function enquiryGuestHtml({ name, whatsapp }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1C1917">
  <div style="background:#3B5249;padding:24px 32px">
    <h1 style="color:#FAF6F0;margin:0;font-size:20px;font-weight:600">Ton Mai Spa 🌳</h1>
  </div>
  <div style="padding:32px">
    <p>Sawasdee kha, <strong>${name}</strong> 🙏</p>
    <p>Thank you for reaching out. We have received your message and our team will contact you on WhatsApp within a few hours to confirm your booking.</p>
    <p>In the meantime, feel free to explore our treatments at <a href="https://www.tonmaispa.com/spa-menu" style="color:#3B5249">tonmaispa.com/spa-menu</a>.</p>
    <p style="margin-top:32px">With warmth,<br><strong>The Ton Mai Spa Team</strong><br>+${whatsapp} (WhatsApp)</p>
  </div>
  <div style="background:#FAF6F0;padding:16px 32px;font-size:12px;color:#6B6663">
    Ton Mai Spa · 6/11 Moo 2 Wiset Road, Rawai, Phuket 83130 · Open daily 09:00–23:00
  </div>
</div>`
}

export function enquiryOwnerHtml({ name, phone, email, message, source }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1C1917">
  <div style="background:#3B5249;padding:24px 32px">
    <h1 style="color:#FAF6F0;margin:0;font-size:20px">New Enquiry — Ton Mai Spa</h1>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6B6663;width:120px">Name</td><td style="padding:8px 0"><strong>${name}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6B6663">Phone</td><td style="padding:8px 0"><a href="https://wa.me/${phone?.replace(/\D/g,'')}" style="color:#3B5249">${phone}</a></td></tr>
      ${email ? `<tr><td style="padding:8px 0;color:#6B6663">Email</td><td style="padding:8px 0">${email}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6B6663">Source</td><td style="padding:8px 0">${source ?? 'website'}</td></tr>
      ${message ? `<tr><td style="padding:8px 0;color:#6B6663;vertical-align:top">Message</td><td style="padding:8px 0">${message}</td></tr>` : ''}
    </table>
    <div style="margin-top:24px">
      <a href="https://wa.me/${phone?.replace(/\D/g,'')}" style="background:#25D366;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Reply on WhatsApp</a>
    </div>
  </div>
</div>`
}

export function bookingGuestHtml({ name, refCode, date, time, treatment, whatsapp }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1C1917">
  <div style="background:#3B5249;padding:24px 32px">
    <h1 style="color:#FAF6F0;margin:0;font-size:20px">Booking Received 🌿</h1>
  </div>
  <div style="padding:32px">
    <p>Sawasdee kha, <strong>${name}</strong> 🙏</p>
    <p>We have received your booking request.</p>
    <div style="background:#F5F0EA;border-radius:8px;padding:20px;margin:20px 0">
      <p style="margin:0 0 8px"><strong>Reference:</strong> ${refCode}</p>
      <p style="margin:0 0 8px"><strong>Treatment:</strong> ${treatment}</p>
      <p style="margin:0 0 8px"><strong>Date:</strong> ${date}</p>
      <p style="margin:0"><strong>Time:</strong> ${time}</p>
    </div>
    <p>Our team will confirm your booking on WhatsApp shortly. Please have your phone ready.</p>
    <p><strong>Getting here:</strong> 6/11 Moo 2 Wiset Road, Rawai — 5 minutes from Nai Harn Beach. Free parking on site.</p>
    <p style="margin-top:32px">With warmth,<br><strong>The Ton Mai Spa Team</strong></p>
  </div>
</div>`
}

export function bookingOwnerHtml({ name, phone, refCode, date, time, treatment, notes }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1C1917">
  <div style="background:#3B5249;padding:24px 32px">
    <h1 style="color:#FAF6F0;margin:0;font-size:20px">New Booking — ${refCode}</h1>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#6B6663;width:120px">Guest</td><td><strong>${name}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6B6663">Phone</td><td><a href="https://wa.me/${phone?.replace(/\D/g,'')}" style="color:#3B5249">${phone}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6B6663">Treatment</td><td>${treatment}</td></tr>
      <tr><td style="padding:8px 0;color:#6B6663">Date</td><td>${date}</td></tr>
      <tr><td style="padding:8px 0;color:#6B6663">Time</td><td>${time}</td></tr>
      ${notes ? `<tr><td style="padding:8px 0;color:#6B6663;vertical-align:top">Notes</td><td>${notes}</td></tr>` : ''}
    </table>
  </div>
</div>`
}

export function inviteEmailHtml({ fullName, role, actionLink }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1C1917">
  <div style="background:#3B5249;padding:24px 32px">
    <h1 style="color:#FAF6F0;margin:0;font-size:20px">You're invited to Ton Mai Spa</h1>
  </div>
  <div style="padding:32px">
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>You have been invited to join the Ton Mai Spa dashboard as <strong>${role}</strong>.</p>
    <p>Click the button below to set your password and log in.</p>
    <div style="margin:32px 0">
      <a href="${actionLink}" style="background:#3B5249;color:#FAF6F0;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">Accept Invitation</a>
    </div>
    <p style="font-size:12px;color:#6B6663">This link expires in 24 hours. If you weren't expecting this invitation, you can ignore this email.</p>
  </div>
</div>`
}
