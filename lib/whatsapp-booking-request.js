import { createHmac, timingSafeEqual } from 'node:crypto'

const BOOKING_REQUEST_LIFETIME_MS = 24 * 60 * 60 * 1000

function secret() {
  return (
    process.env.BOOKING_REQUEST_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.TWILIO_AUTH_TOKEN?.trim() ||
    ''
  )
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(payload) {
  const key = secret()
  if (!key) throw new Error('Booking request signing secret is not configured')
  return createHmac('sha256', key).update(payload).digest('base64url')
}

export function getPublicSiteUrl() {
  const configured = [
    process.env.TWILIO_WEBHOOK_BASE_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
  ].find(value => value && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(value))
  if (configured) return configured.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '')
  return 'http://localhost:3000'
}

export function createWhatsAppBookingRequestToken({ threadId, whatsappAddress, expiresAt }) {
  const payload = base64url({
    thread_id: threadId,
    whatsapp_address: whatsappAddress,
    expires_at: expiresAt || new Date(Date.now() + BOOKING_REQUEST_LIFETIME_MS).toISOString(),
  })
  return `${payload}.${sign(payload)}`
}

export function verifyWhatsAppBookingRequestToken(token) {
  const raw = String(token ?? '').trim()
  const [payload, receivedSig] = raw.split('.')
  if (!payload || !receivedSig) return { ok: false, error: 'Invalid booking link.' }

  let expectedSig
  try {
    expectedSig = sign(payload)
  } catch (error) {
    return { ok: false, error: error.message }
  }

  const received = Buffer.from(receivedSig)
  const expected = Buffer.from(expectedSig)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, error: 'Invalid booking link.' }
  }

  let data
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'Invalid booking link.' }
  }

  if (!data?.thread_id || !data?.whatsapp_address || !data?.expires_at) {
    return { ok: false, error: 'Invalid booking link.' }
  }
  if (Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false, error: 'This booking link expired. Please ask the WhatsApp assistant for a fresh link.' }
  }

  return { ok: true, data }
}

export function createWhatsAppBookingRequestUrl({ threadId, whatsappAddress }) {
  const token = createWhatsAppBookingRequestToken({ threadId, whatsappAddress })
  return `${getPublicSiteUrl()}/booking-request?token=${encodeURIComponent(token)}`
}
