import { Suspense } from 'react'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import CustomersClient from './CustomersClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data: customers } = await admin
    .from('customers')
    .select('id, display_name, primary_phone_e164, email, notes, visit_count, lifetime_value, last_visit_at, created_at')
    .order('created_at', { ascending: false }).limit(200)

  const ids = (customers ?? []).map(c => c.id)
  let potentialById = {}
  if (ids.length) {
    const { data: openBookings } = await admin
      .from('bookings').select('customer_id, price').in('customer_id', ids).in('status', ['pending', 'confirmed'])
    for (const b of openBookings ?? []) {
      potentialById[b.customer_id] = (potentialById[b.customer_id] ?? 0) + (b.price ?? 0)
    }
  }

  return {
    customers: (customers ?? []).map(c => ({ ...c, potential_value: potentialById[c.id] ?? 0 })),
  }
}

export default async function CustomersPage() {
  const { customers } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Guests</h1>
      <Suspense>
        <CustomersClient initialCustomers={customers} />
      </Suspense>
    </div>
  )
}
