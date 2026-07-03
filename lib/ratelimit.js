// IP rate limiting via Upstash Redis (sliding window)
// Fails open — if Redis is misconfigured, requests pass through.
// This keeps the contact form working even if Redis is down.

let redis = null

function getRedis() {
  if (redis) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  const { Redis } = require('@upstash/redis')
  redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  return redis
}

function getIP(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Check rate limit for an action.
 * @param {Request} req
 * @param {string}  bucket  — e.g. "enquiry", "chat", "booking"
 * @param {object}  opts    — { limit: 5, window: 600 } (window in seconds)
 * @returns {{ success: boolean, remaining: number, retryAfter?: number }}
 */
export async function checkRateLimit(req, bucket, opts = {}) {
  const { limit = 5, window = 600 } = opts

  const client = getRedis()
  if (!client) return { success: true, remaining: limit } // fail open

  try {
    const ip  = getIP(req)
    const key = `rl:${bucket}:${ip}`

    const count = await client.incr(key)
    if (count === 1) await client.expire(key, window)
    const retryAfter = Math.max(1, await client.ttl(key))

    const remaining = Math.max(0, limit - count)
    return { success: count <= limit, remaining, retryAfter }
  } catch (err) {
    console.error('[ratelimit] Redis error — failing open:', err)
    return { success: true, remaining: 0 }
  }
}

export function tooManyRequestsResponse() {
  return Response.json(
    { error: 'Too many requests. Please wait a few minutes and try again.' },
    { status: 429 }
  )
}
