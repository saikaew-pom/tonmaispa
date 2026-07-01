import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import EnquiriesClient from './EnquiriesClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('enquiries')
    .select('id, name, email, phone, message, source, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  return data ?? []
}

export default async function EnquiriesPage() {
  const enquiries = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Enquiries</h1>
      <EnquiriesClient initialEnquiries={enquiries} />
    </div>
  )
}
