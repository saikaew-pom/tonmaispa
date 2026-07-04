import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/customers/[id] — profile + full booking history. Lifetime
// stats (visit_count, lifetime_value, last_visit_at) come straight off the
// customers row, kept in sync by the sync_customer_stats() trigger.
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const [{ data: customer, error }, { data: bookings }] = await Promise.all([
    auth.admin.from('customers').select('id, display_name, primary_phone_e164, email, notes, visit_count, lifetime_value, last_visit_at, created_at, updated_at').eq('id', id).single(),
    auth.admin.from('bookings')
      .select('id, ref_code, date, time_slot, duration, price, status, source, notes, spa_treatments(name)')
      .eq('customer_id', id).order('date', { ascending: false }).order('time_slot', { ascending: false }),
  ])
  if (error || !customer) return Response.json({ error: 'Customer not found' }, { status: 404 })

  return Response.json({ customer, bookings: bookings ?? [] })
}

// PATCH /api/admin/customers/[id] — { display_name?, primary_phone_e164?, email?, notes? }
// Editing the phone here only updates the customer record itself — it does
// not retroactively rewrite guest_phone on past booking rows (those stay as
// a point-in-time record of what was entered at booking time).
export async function PATCH(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { display_name, primary_phone_e164, email, notes } = await req.json()

  const updates = { updated_at: new Date().toISOString() }
  if (display_name !== undefined) updates.display_name = display_name
  if (primary_phone_e164 !== undefined) updates.primary_phone_e164 = primary_phone_e164
  if (email !== undefined) updates.email = email || null
  if (notes !== undefined) updates.notes = notes || null

  const { data, error } = await auth.admin
    .from('customers').update(updates).eq('id', id)
    .select('id, display_name, primary_phone_e164, email, notes').single()

  if (error) {
    const message = error.code === '23505' ? 'Another customer already has this phone number.' : error.message
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json({ customer: data })
}
