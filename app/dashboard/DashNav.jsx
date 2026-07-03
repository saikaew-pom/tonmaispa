'use client'

import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BASE_LINKS = [
  { href: '/dashboard',            label: 'Overview' },
  { href: '/dashboard/bookings',   label: 'Bookings' },
  { href: '/dashboard/insights',   label: 'Insights', flag: 'insights' },
  { href: '/dashboard/campaigns',  label: 'Campaigns', flag: 'campaigns' },
  { href: '/dashboard/availability', label: 'Availability' },
  { href: '/dashboard/therapists',   label: 'Therapists' },
  { href: '/dashboard/enquiries',  label: 'Enquiries' },
  { href: '/dashboard/treatments', label: 'Treatments' },
  { href: '/dashboard/menu',       label: 'Restaurant Menu' },
  { href: '/dashboard/gallery',    label: 'Gallery' },
  { href: '/dashboard/settings',   label: 'Settings' },
]

export default function DashNav({ fullName, role, email, insightsEnabled = true, campaignsEnabled = true }) {
  const pathname = usePathname()
  const router   = useRouter()
  const LINKS = BASE_LINKS.filter(l =>
    (l.flag !== 'insights' || insightsEnabled) && (l.flag !== 'campaigns' || campaignsEnabled)
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: '#1C1917', color: '#FAF6F0',
      display: 'flex', flexDirection: 'column', padding: '24px 0',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(250,246,240,0.12)' }}>
        <div style={{ font: '400 22px Cormorant Garamond,serif' }}>Ton Mai Spa</div>
        <div style={{ font: '600 10px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#C4924A', marginTop: 2 }}>Dashboard</div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {LINKS.map(l => {
          const active = l.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(l.href)
          return (
            <a key={l.href} href={l.href} style={{
              padding: '10px 12px', borderRadius: 4, textDecoration: 'none',
              font: '500 13px Inter,sans-serif',
              color: active ? '#1C1917' : 'rgba(250,246,240,0.75)',
              background: active ? '#C4924A' : 'transparent',
            }}>
              {l.label}
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(250,246,240,0.12)' }}>
        <div style={{ font: '600 13px Inter,sans-serif', color: '#FAF6F0' }}>{fullName || email}</div>
        <div style={{ font: '400 11px Inter,sans-serif', color: 'rgba(250,246,240,0.5)', marginTop: 2, textTransform: 'capitalize' }}>{role?.replace('_', ' ')}</div>
        <button onClick={handleLogout} style={{
          marginTop: 12, background: 'none', border: '1px solid rgba(250,246,240,0.25)', color: 'rgba(250,246,240,0.8)',
          borderRadius: 4, padding: '7px 12px', font: '500 11px Inter,sans-serif', cursor: 'pointer', width: '100%',
        }}>
          Log out
        </button>
      </div>
    </aside>
  )
}
