import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { bookingLookupCodeHtml, sendEmail } from '@/lib/brevo'
import { checkRateLimit, tooManyRequestsResponse } from '@/lib/ratelimit'

const CODE_LIFETIME_MS = 10 * 60 * 1000
const ACCESS_LIFETIME_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

const requestSchema = z.object({
  action: z.literal('request'),
  sessionId: z.string().uuid(),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(200),
})

const verifySchema = z.object({
  action: z.literal('verify'),
  sessionId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
})

function normalizePhone(value) {
  const compact = String(value ?? '').trim().replace(/[\s().-]/g, '')
  return compact.startsWith('+') ? compact : `+${compact}`
}

function lookupSecret() {
  return process.env.BOOKING_LOOKUP_SECRET || process.env.CRON_SECRET
}

function hashCode(sessionId, code) {
  return createHmac('sha256', lookupSecret()).update(`${sessionId}:${code}`).digest('hex')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

function publicBooking(booking) {
  return {
    booking_id: booking.id,
    ref_code: booking.ref_code,
    treatment: booking.spa_treatments?.name ?? 'Spa treatment',
    date: booking.date,
    time: booking.time_slot?.slice(0, 5),
    duration: booking.duration,
    price: booking.price,
    status: booking.status,
  }
}

export async function POST(req) {
  const rateLimit = await checkRateLimit(req, 'booking-lookup', { limit: 8, window: 600 })
  if (!rateLimit.success) return tooManyRequestsResponse()
  if (!lookupSecret()) return Response.json({ error: 'Secure booking lookup is not configured.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const admin = createSupabaseAdminClient()

  if (body.action === 'request') {
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Enter a valid phone number and email.' }, { status: 400 })

    const phone = normalizePhone(parsed.data.phone)
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return Response.json({ error: 'Phone number must include its country code.' }, { status: 400 })
    }

    const email = parsed.data.email.toLowerCase()
    const { data: customer } = await admin.from('customers')
      .select('id, display_name, email')
      .eq('primary_phone_e164', phone)
      .ilike('email', email)
      .maybeSingle()

    const code = String(randomInt(100000, 1000000))
    const { data: session } = await admin.from('chat_sessions')
      .select('metadata').eq('session_id', parsed.data.sessionId).maybeSingle()
    const metadata = { ...(session?.metadata ?? {}) }
    const previousSentAt = metadata.booking_lookup_verification?.sent_at
    if (previousSentAt && Date.now() - Date.parse(previousSentAt) < 60_000) {
      return Response.json({ error: 'Please wait one minute before requesting another code.' }, { status: 429 })
    }
    delete metadata.booking_access
    metadata.booking_lookup_verification = {
      code_hash: hashCode(parsed.data.sessionId, code),
      customer_id: customer?.id ?? null,
      expires_at: new Date(Date.now() + CODE_LIFETIME_MS).toISOString(),
      attempts: 0,
      sent_at: new Date().toISOString(),
    }
    await admin.from('chat_sessions').upsert({
      session_id: parsed.data.sessionId,
      metadata,
      last_active: new Date().toISOString(),
    }, { onConflict: 'session_id' })

    if (customer) {
      const sent = await sendEmail({
        to: customer.email,
        subject: 'Your Ton Mai Spa booking verification code',
        html: bookingLookupCodeHtml({ name: customer.display_name, code }),
      })
      if (!sent.ok) return Response.json({ error: 'We could not send the verification email. Please try again.' }, { status: 502 })
    }

    return Response.json({
      ok: true,
      message: 'If those details match a booking profile, a six-digit code has been sent by email.',
    })
  }

  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Enter the six-digit verification code.' }, { status: 400 })

  const { data: session } = await admin.from('chat_sessions')
    .select('metadata').eq('session_id', parsed.data.sessionId).maybeSingle()
  const verification = session?.metadata?.booking_lookup_verification
  if (!verification || !verification.expires_at || Date.parse(verification.expires_at) <= Date.now()) {
    return Response.json({ error: 'This code has expired. Request a new one.' }, { status: 410 })
  }
  if ((verification.attempts ?? 0) >= MAX_ATTEMPTS) {
    return Response.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 })
  }

  const metadata = { ...(session.metadata ?? {}) }
  const valid = verification.customer_id
    && safeEqual(verification.code_hash, hashCode(parsed.data.sessionId, parsed.data.code))
  if (!valid) {
    metadata.booking_lookup_verification = {
      ...verification,
      attempts: (verification.attempts ?? 0) + 1,
    }
    await admin.from('chat_sessions').update({ metadata }).eq('session_id', parsed.data.sessionId)
    return Response.json({ error: 'That code is incorrect.' }, { status: 400 })
  }

  delete metadata.booking_lookup_verification
  // Verification succeeded — the pending "please verify" card no longer
  // applies; clear it so a later reload doesn't reopen an obsolete prompt.
  delete metadata.booking_lookup_pending
  metadata.booking_access = {
    customer_id: verification.customer_id,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ACCESS_LIFETIME_MS).toISOString(),
  }
  const { error: sessionError } = await admin.from('chat_sessions').update({
    customer_id: verification.customer_id,
    metadata,
    last_active: new Date().toISOString(),
  }).eq('session_id', parsed.data.sessionId)
  if (sessionError) return Response.json({ error: 'Could not verify this session. Please try again.' }, { status: 500 })

  await admin.from('conversation_threads')
    .update({ customer_id: verification.customer_id })
    .eq('web_session_id', parsed.data.sessionId)

  const { data: bookings } = await admin.from('bookings')
    .select('id, ref_code, date, time_slot, duration, price, status, spa_treatments(name)')
    .eq('customer_id', verification.customer_id)
    .in('status', ['pending', 'confirmed'])
    .order('date', { ascending: true })
    .order('time_slot', { ascending: true })
    .limit(20)

  return Response.json({ ok: true, bookings: (bookings ?? []).map(publicBooking), expires_in: 3600 })
}
