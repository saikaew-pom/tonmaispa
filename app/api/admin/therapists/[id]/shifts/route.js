import { requireAdmin } from '@/lib/require-admin'

// GET /api/admin/therapists/[id]/shifts?year=2026&month=7 — list shifts for a month
export async function GET(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year'), 10)
  const month = parseInt(searchParams.get('month'), 10) // 1-12
  if (!year || !month) return Response.json({ error: 'year and month are required' }, { status: 400 })

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await auth.admin
    .from('therapist_shifts')
    .select('id, date, start_time, end_time, break_start, break_end')
    .eq('therapist_id', params.id)
    .gte('date', start)
    .lte('date', end)
    .order('date')

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ shifts: data ?? [] })
}

// PUT /api/admin/therapists/[id]/shifts — upsert one date's shift
export async function PUT(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { date, start_time, end_time, break_start, break_end } = await req.json()
  if (!date || !start_time || !end_time) {
    return Response.json({ error: 'date, start_time and end_time are required' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('therapist_shifts')
    .upsert({ therapist_id: params.id, date, start_time, end_time, break_start: break_start || null, break_end: break_end || null }, { onConflict: 'therapist_id,date' })
    .select('id, date, start_time, end_time, break_start, break_end')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, shift: data })
}

// DELETE /api/admin/therapists/[id]/shifts?date=YYYY-MM-DD — clear one date (day off)
export async function DELETE(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return Response.json({ error: 'date is required' }, { status: 400 })

  const { error } = await auth.admin.from('therapist_shifts').delete().eq('therapist_id', params.id).eq('date', date)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
