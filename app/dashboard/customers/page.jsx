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

  return { customers: customers ?? [] }
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
