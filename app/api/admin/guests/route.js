import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/guests?search=... — list/search guests, with lightweight
// booking-count and last-visit stats for the list view. Full history +
// lifetime value lives behind GET /api/admin/guests/[id].
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()

  let query = auth.admin.from('guests').select('id, full_name, phone, email, notes, created_at').order('created_at', { ascending: false }).limit(200)
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: guests, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 400 })

  const ids = (guests ?? []).map(g => g.id)
  let statsById = {}
  if (ids.length) {
    const { data: bookings } = await auth.admin
      .from('bookings').select('guest_id, price, date, status').in('guest_id', ids)
    for (const b of bookings ?? []) {
      const s = (statsById[b.guest_id] ??= { bookingCount: 0, lifetimeSpend: 0, lastVisit: null })
      s.bookingCount += 1
      if (b.status === 'completed') s.lifetimeSpend += b.price ?? 0
      if (!s.lastVisit || b.date > s.lastVisit) s.lastVisit = b.date
    }
  }

  return Response.json({
    guests: (guests ?? []).map(g => ({ ...g, ...(statsById[g.id] ?? { bookingCount: 0, lifetimeSpend: 0, lastVisit: null }) })),
  })
}
