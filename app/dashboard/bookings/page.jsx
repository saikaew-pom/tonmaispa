import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import BookingsClient from './BookingsClient'

export const dynamic = 'force-dynamic'

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim())
  )
}

async function getData() {
  const admin = createSupabaseAdminClient()
  const [bookingsRes, treatmentsRes, therapistsRes, settingsRes] = await Promise.all([
    admin.from('bookings')
      .select('id, ref_code, guest_name, guest_phone, guest_email, customer_id, treatment_id, therapist_id, date, time_slot, duration, price, status, source, notes, staff_notes, last_email_sent_at, last_email_status, last_whatsapp_sent_at, last_whatsapp_status, spa_treatments(name)')
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
    admin.from('site_content').select('value_text').eq('key', 'settings.twilio_whatsapp_enabled').maybeSingle(),
  ])
  return {
    bookings:   bookingsRes.data ?? [],
    treatments: treatmentsRes.data ?? [],
    therapists: therapistsRes.data ?? [],
    twilioEnabled: settingsRes.data?.value_text === 'true' && isTwilioConfigured(),
  }
}

export default async function BookingsPage() {
  const { bookings, treatments, therapists, twilioEnabled } = await getData()
  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Bookings</h1>
      <BookingsClient initialBookings={bookings} treatments={treatments} therapists={therapists} twilioEnabled={twilioEnabled} />
    </div>
  )
}
