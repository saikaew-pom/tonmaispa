// settings.maintenance_mode — the one switch that takes the public site down
// to a WhatsApp-only holding page.
//
// Deliberately NOT enforced in middleware: that would cost a DB round-trip on
// every public request, and the whole point of the / -> /en rewrite was to
// protect mobile LCP. It is read inside the ISR'd server render instead, so a
// cached page costs nothing. The trade is that flipping the toggle takes up to
// the 60s revalidate window to reach every page — the same propagation every
// other setting already has.
//
// Fails OPEN on purpose: if the settings read throws, the site stays UP. A
// database hiccup must never black out a working spa website; the failure mode
// of a stuck maintenance page is far worse than the failure mode of a missed
// one, which staff can always re-trigger.

import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export const MAINTENANCE_KEY = 'settings.maintenance_mode'

export function maintenanceOn(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

export async function isMaintenanceMode(admin) {
  try {
    const db = admin ?? createSupabaseAdminClient()
    const { data } = await db
      .from('site_content')
      .select('value_text')
      .eq('key', MAINTENANCE_KEY)
      .maybeSingle()
    return maintenanceOn(data?.value_text)
  } catch {
    return false // fail open — see above
  }
}

// For public write routes. During maintenance the forms aren't reachable, but a
// crafted POST still is — and a booking accepted behind a "we're closed" page
// is a promise the spa never agreed to.
export function maintenanceResponse() {
  return Response.json(
    { error: 'Our website is briefly unavailable for maintenance. Please message us on WhatsApp and we will help you right away.' },
    { status: 503, headers: { 'Retry-After': '600' } },
  )
}
