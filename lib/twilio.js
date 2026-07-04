import { createHmac, timingSafeEqual } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function normalizeWhatsAppAddress(value) {
  const raw = String(value ?? '').trim()
  if (!raw) throw new Error('A WhatsApp phone number is required')

  const withoutPrefix = raw.replace(/^whatsapp:/i, '')
  const digits = withoutPrefix.replace(/[^\d+]/g, '')
  const e164 = digits.startsWith('+') ? digits : `+${digits}`

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new Error('WhatsApp phone number must be in E.164 format')
  }

  return `whatsapp:${e164}`
}

export function getTwilioRequestUrl(request) {
  const configuredBase = process.env.TWILIO_WEBHOOK_BASE_URL?.trim()?.replace(/\/$/, '')
  const incoming = new URL(request.url)

  if (configuredBase) {
    return `${configuredBase}${incoming.pathname}${incoming.search}`
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')

  if (host) {
    return `${forwardedProto || incoming.protocol.replace(':', '')}://${host}${incoming.pathname}${incoming.search}`
  }

  return incoming.toString()
}

export function validateTwilioSignature({ authToken, signature, url, params = {} }) {
  if (!authToken || !signature || !url) return false

  const data = Object.keys(params)
    .sort()
    .reduce((value, key) => `${value}${key}${params[key] ?? ''}`, url)

  const expected = createHmac('sha1', authToken).update(data, 'utf8').digest('base64')
  const receivedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export async function parseAndValidateTwilioWebhook(request) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return { valid: false, status: 415, error: 'Expected a form-encoded Twilio webhook' }
  }

  const formData = await request.formData()
  const params = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  )

  const valid = validateTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    signature: request.headers.get('x-twilio-signature'),
    url: getTwilioRequestUrl(request),
    params,
  })

  return valid
    ? { valid: true, params }
    : { valid: false, status: 403, error: 'Invalid Twilio signature' }
}

export async function sendWhatsAppMessage({
  to,
  body,
  contentSid,
  contentVariables,
  statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL,
}) {
  if (!body && !contentSid) throw new Error('A message body or Content SID is required')

  const accountSid = requiredEnv('TWILIO_ACCOUNT_SID')
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim() || accountSid
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim() || requiredEnv('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim()

  if (!messagingServiceSid && !from) {
    throw new Error('TWILIO_MESSAGING_SERVICE_SID or TWILIO_WHATSAPP_FROM is required')
  }

  const form = new URLSearchParams()
  form.set('To', normalizeWhatsAppAddress(to))
  if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid)
  else form.set('From', normalizeWhatsAppAddress(from))
  if (body) form.set('Body', body)
  if (contentSid) form.set('ContentSid', contentSid)
  if (contentVariables) {
    form.set('ContentVariables', typeof contentVariables === 'string'
      ? contentVariables
      : JSON.stringify(contentVariables))
  }
  if (statusCallbackUrl) form.set('StatusCallback', statusCallbackUrl)

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })

  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.message || 'Twilio rejected the WhatsApp message')
    error.code = result.code
    error.status = response.status
    throw error
  }

  const admin = createSupabaseAdminClient()
  const { error: logError } = await admin.from('twilio_messages').upsert({
    twilio_message_sid: result.sid,
    direction: 'outbound',
    from_address: result.from || from || messagingServiceSid,
    to_address: result.to || normalizeWhatsAppAddress(to),
    body: body || null,
    content_sid: contentSid || null,
    status: result.status || 'queued',
    raw_payload: result,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'twilio_message_sid' })

  if (logError) console.error('[twilio] failed to store outbound message:', logError.message)
  return result
}

export function emptyTwimlResponse() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}
