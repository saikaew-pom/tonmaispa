import { Suspense } from 'react'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import GuestsClient from './GuestsClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const { data: guests } = await admin
    .from('guests').select('id, full_name, phone, email, notes, created_at')
    .order('created_at', { ascending: false }).limit(200)

  const ids = (guests ?? []).map(g => g.id)
  let statsById = {}
  if (ids.length) {
    const { data: bookings } = await admin.from('bookings').select('guest_id, price, date, status').in('guest_id', ids)
    for (const b of bookings ?? []) {
      const s = (statsById[b.guest_id] ??= { bookingCount: 0, lifetimeSpend: 0, lastVisit: null })
      s.bookingCount += 1
      if (b.status === 'completed') s.lifetimeSpend += b.price ?? 0
      if (!s.lastVisit || b.date > s.lastVisit) s.lastVisit = b.date
    }
  }

  return {
    guests: (guests ?? []).map(g => ({ ...g, ...(statsById[g.id] ?? { bookingCount: 0, lifetimeSpend: 0, lastVisit: null }) })),
  }
}

export default async function GuestsPage() {
  const { guests } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Guests</h1>
      <Suspense>
        <GuestsClient initialGuests={guests} />
      </Suspense>
    </div>
  )
}
