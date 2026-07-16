// Add-on resolution — the single place that turns a list of add-on ids from a
// client into trusted minutes, price and line items.
//
// Never trust client-supplied durations or prices: only ids come in, every
// value is re-read from spa_treatments here. Mirrors how bookings.price is
// always derived server-side from the treatment, never from the request.

const MAX_ADDONS = 5

// An add-on's own "duration option" is its length (Scalp Oil [15], Eye Mask
// [0] — a real add-on that costs money but adds no time).
function addonMinutes(t) {
  const first = (t.duration_options ?? [])[0]
  return Number.isFinite(first) ? first : 0
}

function addonPrice(t) {
  const key = String(addonMinutes(t))
  const p = t.prices?.[key]
  return Number.isFinite(p) ? p : null
}

/**
 * Resolve add-on ids against the live catalog.
 * Returns { ok, minutes, price, items } or { ok:false, error }.
 * items are SNAPSHOTS for booking_addons — a later catalog edit must not
 * rewrite what the guest was quoted.
 */
export async function resolveAddons(admin, addonIds) {
  const ids = [...new Set((addonIds ?? []).filter(Boolean).map(String))]
  if (!ids.length) return { ok: true, minutes: 0, price: 0, items: [] }
  if (ids.length > MAX_ADDONS) {
    return { ok: false, error: `You can add at most ${MAX_ADDONS} extras to one booking.` }
  }

  const { data, error } = await admin
    .from('spa_treatments')
    .select('id, name, category, duration_options, prices, is_active')
    .in('id', ids)
  if (error) return { ok: false, error: error.message }

  const rows = data ?? []
  // Anything that isn't a live add-on is rejected outright rather than
  // silently dropped — otherwise a guest could be shown a total that the
  // booking never actually contains.
  for (const id of ids) {
    const t = rows.find(r => r.id === id)
    if (!t) return { ok: false, error: 'One of the selected extras is no longer available.' }
    if (t.is_active === false) return { ok: false, error: `"${t.name}" is no longer available.` }
    if (t.category !== 'add_on') return { ok: false, error: `"${t.name}" cannot be added as an extra.` }
  }

  const items = rows.map(t => ({
    treatment_id: t.id,
    name: t.name,
    duration: addonMinutes(t),
    price: addonPrice(t),
  }))

  return {
    ok: true,
    minutes: items.reduce((sum, i) => sum + i.duration, 0),
    price: items.reduce((sum, i) => sum + (i.price ?? 0), 0),
    items,
  }
}

/**
 * Persist the line items for a booking. Never throws: the booking itself is
 * already committed by this point and a failed line-item write must not lose
 * it — the minutes and price are on the booking row regardless.
 */
export async function saveBookingAddons(admin, bookingId, items) {
  if (!items?.length) return
  const { error } = await admin
    .from('booking_addons')
    .insert(items.map(i => ({ booking_id: bookingId, ...i })))
  if (error) console.error('[booking-addons] could not save line items:', error.message)
}

// "Scalp Oil Treatment (+15 min, ฿200), Eye Mask Add-On (฿150)"
export function describeAddons(items) {
  if (!items?.length) return ''
  return items.map(i => {
    const bits = []
    if (i.duration > 0) bits.push(`+${i.duration} min`)
    if (i.price != null) bits.push(`฿${i.price}`)
    return bits.length ? `${i.name} (${bits.join(', ')})` : i.name
  }).join(', ')
}
