import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import TreatmentsClient from './TreatmentsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('spa_treatments')
    .select('*')
    .order('category')
    .order('sort_order')
  return data ?? []
}

export default async function TreatmentsPage() {
  const treatments = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Treatments</h1>
      <TreatmentsClient initialTreatments={treatments} />
    </div>
  )
}
