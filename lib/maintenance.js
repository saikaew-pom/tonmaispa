// settings.maintenance_mode — the switch that takes the public site down to a
// WhatsApp-only holding page.
//
// ⚠ HISTORY (read before touching): the first attempt read this flag inside the
// ISR'd [lang] layout. Production then served the maintenance page with the
// flag OFF — a build-time render got baked into the ISR cache and served stale.
// Root cause never fully proven; reverted (commit 5f52584). The lesson stands:
// NEVER decide maintenance inside a statically-prerendered/ISR'd render.
//
// This version decides in MIDDLEWARE, which runs fresh on every request and is
// never cached into a page — so the stale-cache failure class cannot recur.
//
// This module is EDGE-SAFE: no node-only imports, so `middleware.js` can import
// it. The server-side check for API routes takes an already-built admin client
// as an argument (no import here) to keep it that way.

export const MAINTENANCE_KEY = 'settings.maintenance_mode'

export function maintenanceOn(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

// Module-scope cache: warm edge isolates reuse this across requests, so the
// per-request DB cost is amortised to ~one read per TTL per isolate.
const CACHE = { value: null, at: 0 }
const TTL_MS = 30_000

// Edge/middleware read of the PUBLIC flag (site_content is public-readable, so
// the anon key suffices — no service role at the edge). Fails OPEN: any error,
// or a cold cache during an outage, keeps the site UP. A black-out from a DB
// blip is far worse than a missed maintenance flip, which staff can re-trigger.
export async function fetchMaintenanceFlag() {
  const now = Date.now()
  if (CACHE.value !== null && now - CACHE.at < TTL_MS) return CACHE.value

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false

  try {
    const res = await fetch(
      `${url}/rest/v1/site_content?select=value_text&key=eq.${MAINTENANCE_KEY}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) return CACHE.value ?? false
    const rows = await res.json()
    const on = maintenanceOn(rows?.[0]?.value_text)
    CACHE.value = on
    CACHE.at = now
    return on
  } catch {
    return CACHE.value ?? false // stale-but-up, never black out
  }
}

// Server-side read for public write routes (they already hold an admin client,
// and their renders are dynamic — no ISR staleness). Fails open.
export async function isMaintenanceMode(admin) {
  try {
    const { data } = await admin
      .from('site_content')
      .select('value_text')
      .eq('key', MAINTENANCE_KEY)
      .maybeSingle()
    return maintenanceOn(data?.value_text)
  } catch {
    return false
  }
}

// For public write routes: refuse work behind a "we're closed" page. The forms
// are unreachable during maintenance, but a crafted POST is not — and a booking
// accepted while the site says closed is a promise the spa never made.
export function maintenanceResponse() {
  return Response.json(
    { error: 'Our website is briefly unavailable for maintenance. Please message us on WhatsApp and we will help you right away.' },
    { status: 503, headers: { 'Retry-After': '600' } },
  )
}
