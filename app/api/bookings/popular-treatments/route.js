import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const WINDOW_DAYS = 45
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

function bangkokDate(daysFromToday = 0) {
  const date = new Date(Date.now() + BANGKOK_OFFSET_MS)
  date.setUTCDate(date.getUTCDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

export async function GET() {
  const admin = createSupabaseAdminClient()
  const endDate = bangkokDate()
  const startDate = bangkokDate(-(WINDOW_DAYS - 1))

  const [treatmentsResult, bookingsResult] = await Promise.all([
    admin.from('spa_treatments')
      .select('id, category')
      .eq('is_active', true)
      .order('sort_order'),
    admin.from('bookings')
      .select('treatment_id')
      .in('status', ['confirmed', 'completed'])
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  if (treatmentsResult.error || bookingsResult.error) {
    console.error('[popular treatments] query error:', treatmentsResult.error ?? bookingsResult.error)
    return Response.json({ error: 'Could not load popular treatments.' }, { status: 500 })
  }

  const bookingCounts = new Map()
  for (const booking of bookingsResult.data ?? []) {
    if (!booking.treatment_id) continue
    bookingCounts.set(booking.treatment_id, (bookingCounts.get(booking.treatment_id) ?? 0) + 1)
  }

  const treatmentIds = (treatmentsResult.data ?? [])
    .map((treatment, curatedIndex) => ({
      ...treatment,
      curatedIndex,
      bookingCount: bookingCounts.get(treatment.id) ?? 0,
    }))
    .filter(treatment => treatment.category !== 'add_on')
    .sort((a, b) => b.bookingCount - a.bookingCount || a.curatedIndex - b.curatedIndex)
    .slice(0, 5)
    .map(treatment => treatment.id)

  return Response.json({
    treatment_ids: treatmentIds,
    window: { days: WINDOW_DAYS, start: startDate, end: endDate },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  })
}
