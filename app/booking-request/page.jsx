import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { verifyWhatsAppBookingRequestToken } from '@/lib/whatsapp-booking-request'
import BookingRequestClient from './BookingRequestClient'

export const dynamic = 'force-dynamic'

export default async function BookingRequestPage({ searchParams }) {
  const params = await searchParams
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token
  const verified = verifyWhatsAppBookingRequestToken(token)

  if (!verified.ok) {
    return <Shell><Invalid message={verified.error} /></Shell>
  }

  const admin = createSupabaseAdminClient()
  const [threadRes, treatmentsRes] = await Promise.all([
    admin
      .from('conversation_threads')
      .select('id, whatsapp_address, customers(display_name, email, primary_phone_e164)')
      .eq('id', verified.data.thread_id)
      .eq('whatsapp_address', verified.data.whatsapp_address)
      .maybeSingle(),
    admin
      .from('spa_treatments')
      .select('id, name, category, duration_options, prices')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (!threadRes.data) {
    return <Shell><Invalid message="This booking link is no longer connected to a WhatsApp conversation." /></Shell>
  }

  const phone = verified.data.whatsapp_address.replace(/^whatsapp:/, '')
  const customer = threadRes.data.customers

  return (
    <Shell>
      <BookingRequestClient
        token={token}
        treatments={treatmentsRes.data ?? []}
        initialGuest={{
          name: customer?.display_name ?? '',
          phone: customer?.primary_phone_e164 ?? phone,
          email: customer?.email ?? '',
        }}
      />
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <main style={{ minHeight: '100vh', background: '#F8F2EA', padding: '32px 16px', color: '#1C1917' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ font: '700 12px Inter,sans-serif', letterSpacing: 3, textTransform: 'uppercase', color: '#C4924A' }}>Ton Mai Spa</div>
          <h1 style={{ margin: '8px 0 8px', font: '400 44px/1 Cormorant Garamond,serif' }}>Confirm your booking request</h1>
          <p style={{ margin: 0, font: '400 17px/1.6 Inter,sans-serif', color: '#6B6663' }}>
            Please check the details below. Your booking is not final until our team confirms it.
          </p>
        </div>
        {children}
      </div>
    </main>
  )
}

function Invalid({ message }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E1D8CD', borderRadius: 16, padding: 24 }}>
      <h2 style={{ margin: '0 0 8px', font: '400 30px Cormorant Garamond,serif' }}>Booking link unavailable</h2>
      <p style={{ margin: 0, font: '400 15px/1.6 Inter,sans-serif', color: '#6B6663' }}>{message}</p>
      <p style={{ margin: '14px 0 0', font: '600 14px/1.5 Inter,sans-serif', color: '#3B5249' }}>
        Please return to WhatsApp and ask the assistant for a fresh booking link.
      </p>
    </section>
  )
}
