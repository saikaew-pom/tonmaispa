import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/customers?search=... — list/search customers. Stats
// (visit_count, lifetime_value, last_visit_at) are stored columns kept in
// sync by the sync_customer_stats() trigger on bookings, not computed here.
export async function GET(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()

  let query = auth.admin
    .from('customers')
    .select('id, display_name, primary_phone_e164, email, notes, visit_count, lifetime_value, last_visit_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (search) {
    query = query.or(`display_name.ilike.%${search}%,primary_phone_e164.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: customers, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 400 })

  return Response.json({ customers: customers ?? [] })
}
