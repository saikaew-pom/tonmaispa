import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getData() {
  const admin = createSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [newEnquiries, todayBookings, upcomingBookings] = await Promise.all([
    admin.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('date', today),
    admin.from('bookings').select('id, guest_name, date, time_slot, status').gte('date', today).order('date').order('time_slot').limit(8),
  ])

  return {
    newEnquiriesCount:  newEnquiries.count ?? 0,
    todayBookingsCount: todayBookings.count ?? 0,
    upcoming:           upcomingBookings.data ?? [],
  }
}

export default async function DashboardOverview() {
  const { newEnquiriesCount, todayBookingsCount, upcoming } = await getData()

  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="New Enquiries" value={newEnquiriesCount} href="/dashboard/enquiries" />
        <StatCard label="Bookings Today" value={todayBookingsCount} href="/dashboard/bookings" />
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 24 }}>
        <h2 style={{ font: '600 13px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6663', margin: '0 0 16px' }}>Upcoming Bookings</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: '#9B9390', font: '400 14px Inter,sans-serif' }}>No upcoming bookings.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {upcoming.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F0ECE6' }}>
                  <td style={{ padding: '10px 4px', font: '600 13px Inter,sans-serif' }}>{b.guest_name}</td>
                  <td style={{ padding: '10px 4px', font: '400 13px Inter,sans-serif', color: '#6B6663' }}>{b.date} · {b.time_slot?.slice(0,5)}</td>
                  <td style={{ padding: '10px 4px' }}><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, href }) {
  return (
    <a href={href} style={{ display: 'block', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '20px 22px', textDecoration: 'none' }}>
      <div style={{ font: '400 40px Cormorant Garamond,serif', color: '#3B5249' }}>{value}</div>
      <div style={{ font: '600 11px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', marginTop: 4 }}>{label}</div>
    </a>
  )
}

function StatusBadge({ status }) {
  const colors = {
    pending:   { bg: '#FEF3C7', fg: '#92400E' },
    confirmed: { bg: '#D1FAE5', fg: '#065F46' },
    cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
    completed: { bg: '#E0E7FF', fg: '#3730A3' },
    new:       { bg: '#FEF3C7', fg: '#92400E' },
    resolved:  { bg: '#D1FAE5', fg: '#065F46' },
  }
  const c = colors[status] ?? { bg: '#F0ECE6', fg: '#6B6663' }
  return (
    <span style={{ background: c.bg, color: c.fg, padding: '3px 10px', borderRadius: 999, font: '600 10px Inter,sans-serif', letterSpacing: 0.5, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}
