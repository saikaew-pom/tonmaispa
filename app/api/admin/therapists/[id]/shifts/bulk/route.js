import { requireAdmin } from '@/lib/require-admin'

// PUT /api/admin/therapists/[id]/shifts/bulk — apply the same start/end
// (and optional break) to multiple dates at once, e.g. setting a therapist's
// working hours for a whole month in one action instead of day-by-day.
export async function PUT(req, { params }) {
  const auth = await requireAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const { dates, start_time, end_time, break_start, break_end } = await req.json()
  if (!Array.isArray(dates) || !dates.length || !start_time || !end_time) {
    return Response.json({ error: 'dates, start_time and end_time are required' }, { status: 400 })
  }

  const rows = dates.map(date => ({
    therapist_id: params.id,
    date,
    start_time,
    end_time,
    break_start: break_start || null,
    break_end:   break_end || null,
  }))

  const { data, error } = await auth.admin
    .from('therapist_shifts')
    .upsert(rows, { onConflict: 'therapist_id,date' })
    .select('id, date, start_time, end_time, break_start, break_end')

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, shifts: data })
}
