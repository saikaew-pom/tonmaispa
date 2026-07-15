// Durable staff-invite links.
//
// Supabase's own invite link expires with MAILER_OTP_EXP, which is capped at
// 24h and shared with password resets — so it cannot carry a 5-day invite
// without weakening every reset. Instead we mint our own HMAC-signed token
// (same shape as lib/whatsapp-booking-request.js) that stays valid for 5 days
// and is exchanged for a fresh, short-lived Supabase link at click time.
//
// Revocation: the token is only honoured while profiles.invite_expires_at is
// non-null and in the future, so clearing that column kills every issued link.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPublicSiteUrl } from '@/lib/whatsapp-booking-request'

export const INVITE_LIFETIME_DAYS = 5
const INVITE_LIFETIME_MS = INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000

function secret() {
  return (
    process.env.STAFF_INVITE_SECRET?.trim() ||
    process.env.BOOKING_REQUEST_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  )
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(payload) {
  const key = secret()
  if (!key) throw new Error('Staff invite signing secret is not configured')
  return createHmac('sha256', key).update(payload).digest('base64url')
}

export function getInviteExpiry(from = new Date()) {
  return new Date(from.getTime() + INVITE_LIFETIME_MS).toISOString()
}

// Whole days left, rounded up, floored at 0 — "expires in 1 day" reads better
// than "in 0 days" on the last day.
export function daysRemaining(expiresAt, now = new Date()) {
  const ms = Date.parse(expiresAt) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

// Human date for the email body, in the spa's timezone (the server runs UTC).
export function formatInviteExpiry(expiresAt) {
  // Guard falsy input explicitly: new Date(null) is epoch 0, a *valid* date, so
  // the NaN check below would let it through and print "1 January at 07:00" into
  // a real invite email. daysRemaining() already returns 0 for these.
  if (!expiresAt) return ''
  const d = new Date(expiresAt)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

export function createStaffInviteToken({ userId, email, expiresAt }) {
  if (!userId || !email) throw new Error('userId and email are required')
  const payload = base64url({
    user_id: userId,
    email,
    expires_at: expiresAt || getInviteExpiry(),
  })
  return `${payload}.${sign(payload)}`
}

export function verifyStaffInviteToken(token) {
  const raw = String(token ?? '').trim()
  const [payload, receivedSig] = raw.split('.')
  if (!payload || !receivedSig) return { ok: false, reason: 'invalid' }

  let expectedSig
  try {
    expectedSig = sign(payload)
  } catch {
    return { ok: false, reason: 'misconfigured' }
  }

  const received = Buffer.from(receivedSig)
  const expected = Buffer.from(expectedSig)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'invalid' }
  }

  let data
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (!data?.user_id || !data?.email || !data?.expires_at) {
    return { ok: false, reason: 'invalid' }
  }
  if (Date.parse(data.expires_at) <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, data }
}

export function createStaffInviteUrl({ userId, email, expiresAt }) {
  const token = createStaffInviteToken({ userId, email, expiresAt })
  return `${getPublicSiteUrl()}/invite?token=${encodeURIComponent(token)}`
}
