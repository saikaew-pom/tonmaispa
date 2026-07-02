import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/room-capacity — all 7 weekday rows
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin.from('room_capacity').select('day_of_week, room_count').order('day_of_week')
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ rooms: data ?? [] })
}

// PATCH /api/admin/room-capacity — { day_of_week, room_count }
export async function PATCH(req) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { day_of_week, room_count } = await req.json()
  if (day_of_week === undefined || room_count === undefined) {
    return Response.json({ error: 'day_of_week and room_count are required' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('room_capacity')
    .update({ room_count })
    .eq('day_of_week', day_of_week)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, room: data })
}
