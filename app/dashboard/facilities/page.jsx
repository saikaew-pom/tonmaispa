import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import FacilitiesClient from './FacilitiesClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data: facilities } = await admin
    .from('facilities').select('*').order('sort_order', { ascending: true })
  return { facilities: facilities ?? [] }
}

export default async function FacilitiesPage() {
  const { facilities } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 8px' }}>Facilities</h1>
      <p style={{ font: '400 13px Inter,sans-serif', color: '#6B6663', margin: '0 0 24px' }}>
        The photo gallery in the homepage &ldquo;Facilities&rdquo; section — steam room, sauna, pool, garden, restaurant, etc. Section heading/subtitle are edited in Settings.
      </p>
      <FacilitiesClient initialFacilities={facilities} />
    </div>
  )
}
