// POST /api/enquiries — public 3-field contact/booking form
// Rate limit → Turnstile → Zod → Supabase → email notifications

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isMaintenanceMode, maintenanceResponse } from '@/lib/maintenance'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'
import { verifyTurnstile }  from '@/lib/verify-turnstile'
import { enquirySchema }    from '@/lib/schemas'
import { sendEmail, enquiryGuestHtml, enquiryOwnerHtml } from '@/lib/brevo'

export async function POST(req) {
  // 1. Rate limit — 5 enquiries per 10 min per IP
  const rl = await checkRateLimit(req, 'enquiry', { limit: 5, window: 600 })
  if (!rl.success) return tooManyRequestsResponse()

  const body = await req.json()

  // 2. Turnstile CAPTCHA
  try {
    await verifyTurnstile(body.turnstileToken)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  // 3. Validate
  const parsed = enquirySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, email, phone, message } = parsed.data
  const admin = createSupabaseAdminClient()

  // Refuse to take work behind a "we're closed" page. The forms aren't
  // reachable during maintenance, but a crafted POST still is — and a booking
  // accepted while the site says closed is a promise the spa never made.
  if (await isMaintenanceMode(admin)) return maintenanceResponse()

  // 4. Save to Supabase
  const { data: enquiry, error } = await admin.from('enquiries').insert({
    name,
    email,
    phone,
    message,
    source: 'website',
    status: 'new',
  }).select('id').single()

  if (error) {
    console.error('[enquiries] insert error:', error)
    return Response.json({ error: 'Failed to save. Please try WhatsApp directly.' }, { status: 500 })
  }

  // 5. Send emails (non-blocking — don't fail the response if email fails)
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '66822866058'

  await Promise.allSettled([
    email && sendEmail({
      to:      email,
      subject: 'We received your message — Ton Mai Spa',
      html:    enquiryGuestHtml({ name, whatsapp }),
    }),
    sendEmail({
      to:      process.env.INQUIRY_EMAIL,
      subject: `New enquiry from ${name}`,
      html:    enquiryOwnerHtml({ name, phone, email, message, source: 'website' }),
    }),
  ])

  return Response.json({ ok: true, id: enquiry.id })
}
