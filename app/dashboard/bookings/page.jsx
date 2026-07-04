import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BookingsClient from './BookingsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const [bookingsRes, treatmentsRes, therapistsRes] = await Promise.all([
    admin.from('bookings')
      .select('id, ref_code, guest_name, guest_phone, guest_email, customer_id, treatment_id, therapist_id, date, time_slot, duration, price, status, source, notes, spa_treatments(name)')
      .order('date', { ascending: false })
      .order('time_slot', { ascending: false })
      .limit(500),
    admin.from('spa_treatments')
      .select('id, name, duration_options, prices')
      .eq('is_active', true)
      .order('sort_order'),
    admin.from('therapists')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
  ])
  return {
    bookings:   bookingsRes.data ?? [],
    treatments: treatmentsRes.data ?? [],
    therapists: therapistsRes.data ?? [],
  }
}

export default async function BookingsPage() {
  const { bookings, treatments, therapists } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Bookings</h1>
      <BookingsClient initialBookings={bookings} treatments={treatments} therapists={therapists} />
    </div>
  )
}
