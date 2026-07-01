// Cookie consent — shared between the banner, GA4 loader, and the
// dashboard/footer "Cookie Settings" reopen link.
// Bump CONSENT_VERSION whenever the cookie policy materially changes —
// stored consent from an older version is treated as no consent, so
// visitors are asked again.

export const CONSENT_VERSION = '1.0'
export const CONSENT_STORAGE_KEY = 'tms_cookie_consent'
export const CONSENT_UPDATED_EVENT = 'tms-cookie-consent-updated'
export const OPEN_CONSENT_EVENT = 'tms-open-cookie-settings'

export function getStoredConsent() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function getConsentId() {
  let id = localStorage.getItem('tms_consent_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('tms_consent_id', id)
  }
  return id
}

// Visitors who used the site before analytics consent-gating existed may
// already have GA cookies set. If they decline analytics, honor that by
// actively clearing any _ga* cookies rather than just not adding new ones.
function clearAnalyticsCookies() {
  const domain = window.location.hostname
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim()
    if (name.startsWith('_ga')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${domain}`
    }
  })
}

// Saves the decision locally (drives what loads on this device immediately)
// and logs it server-side (the auditable record required by GDPR Art. 7(1)
// and Thailand PDPA Section 19 — being able to demonstrate consent was given).
export async function saveConsent({ analytics, action }) {
  const record = { version: CONSENT_VERSION, necessary: true, analytics, action, decidedAt: new Date().toISOString() }
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  if (!analytics) clearAnalyticsCookies()
  window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: record }))

  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_id:      getConsentId(),
        analytics,
        action,
        consent_version: CONSENT_VERSION,
        page_url:        window.location.href,
      }),
    })
  } catch {
    // Logging failure shouldn't block the visitor — their local preference already applied.
  }

  return record
}
