import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/guests/[id] — profile + full booking history + stats
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const [{ data: guest, error }, { data: bookings }] = await Promise.all([
    auth.admin.from('guests').select('id, full_name, phone, email, notes, created_at, updated_at').eq('id', id).single(),
    auth.admin.from('bookings')
      .select('id, ref_code, date, time_slot, duration, price, status, source, notes, spa_treatments(name)')
      .eq('guest_id', id).order('date', { ascending: false }).order('time_slot', { ascending: false }),
  ])
  if (error || !guest) return Response.json({ error: 'Guest not found' }, { status: 404 })

  const completed = (bookings ?? []).filter(b => b.status === 'completed')
  const stats = {
    bookingCount: bookings?.length ?? 0,
    completedCount: completed.length,
    cancelledCount: (bookings ?? []).filter(b => b.status === 'cancelled').length,
    lifetimeSpend: completed.reduce((s, b) => s + (b.price ?? 0), 0),
    lastVisit: bookings?.[0]?.date ?? null,
  }

  return Response.json({ guest, bookings: bookings ?? [], stats })
}

// PATCH /api/admin/guests/[id] — { full_name?, phone?, email?, notes? }
// Editing the phone here only updates the guest record itself — it does not
// retroactively rewrite guest_phone on past booking rows (those stay as a
// point-in-time record of what was entered at booking time).
export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { full_name, phone, email, notes } = await req.json()

  const updates = { updated_at: new Date().toISOString() }
  if (full_name !== undefined) updates.full_name = full_name
  if (phone !== undefined) updates.phone = phone
  if (email !== undefined) updates.email = email || null
  if (notes !== undefined) updates.notes = notes || null

  const { data, error } = await auth.admin
    .from('guests').update(updates).eq('id', id)
    .select('id, full_name, phone, email, notes').single()

  if (error) {
    // Most likely a duplicate phone number (unique constraint)
    const message = error.code === '23505' ? 'Another guest already has this phone number.' : error.message
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json({ guest: data })
}
