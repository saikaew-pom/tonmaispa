import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/bookings/[id]/logs — audit trail for the "View logs" modal
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const { data, error } = await auth.admin
    .from('booking_logs')
    .select('id, actor_email, action, detail, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ logs: data ?? [] })
}
