import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BookingsClient from './BookingsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('bookings')
    .select('id, ref_code, guest_name, guest_phone, guest_email, date, time_slot, duration, status, source, notes, spa_treatments(name)')
    .order('date', { ascending: false })
    .order('time_slot', { ascending: false })
    .limit(200)
  return data ?? []
}

export default async function BookingsPage() {
  const bookings = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Bookings</h1>
      <BookingsClient initialBookings={bookings} />
    </div>
  )
}
