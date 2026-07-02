import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import TherapistsClient from './TherapistsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const [therapistsRes, treatmentsRes, capabilitiesRes] = await Promise.all([
    admin.from('therapists').select('*').order('sort_order'),
    admin.from('spa_treatments').select('id, name, category').eq('is_active', true).order('sort_order'),
    admin.from('therapist_treatments').select('therapist_id, treatment_id'),
  ])
  return {
    therapists:   therapistsRes.data ?? [],
    treatments:   treatmentsRes.data ?? [],
    capabilities: capabilitiesRes.data ?? [],
  }
}

export default async function TherapistsPage() {
  const { therapists, treatments, capabilities } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Therapists</h1>
      <TherapistsClient initialTherapists={therapists} treatments={treatments} initialCapabilities={capabilities} />
    </div>
  )
}
