import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import AvailabilityClient from './AvailabilityClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [rulesRes, blocksRes, treatmentsRes, therapistsRes, settingRes, roomsRes] = await Promise.all([
    admin.from('slot_settings').select('*'),
    admin.from('blocked_dates').select('*').gte('date', today).order('date'),
    admin.from('spa_treatments').select('id, name').eq('is_active', true).order('sort_order'),
    admin.from('therapists').select('*').order('sort_order'),
    admin.from('site_content').select('value_text').eq('key', 'settings.booking_engine_enabled').maybeSingle(),
    admin.from('room_capacity').select('day_of_week, room_count').order('day_of_week'),
  ])

  return {
    rules:            rulesRes.data ?? [],
    blocks:           blocksRes.data ?? [],
    treatments:       treatmentsRes.data ?? [],
    therapists:       therapistsRes.data ?? [],
    engineEnabled:    settingRes.data?.value_text === 'true',
    rooms:            roomsRes.data ?? [],
  }
}

export default async function AvailabilityPage() {
  const data = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Availability</h1>
      <AvailabilityClient {...data} />
    </div>
  )
}
