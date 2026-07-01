// Cloudflare Turnstile CAPTCHA verification
// Fails open if secret key is not configured (dev convenience).
// In production, TURNSTILE_SECRET_KEY must be set.

export async function verifyTurnstile(token) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // Dev: skip verification
    return true
  }
  if (!token) {
    throw new Error('Security check failed. Please refresh and try again.')
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret:   process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  })

  const data = await res.json()
  if (!data.success) {
    throw new Error('Security check failed. Please refresh and try again.')
  }

  return true
}
