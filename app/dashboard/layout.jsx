// ============================================================
// TON MAI SPA — Dashboard Layout
// Auth is enforced by middleware.js (redirects to /login).
// This layout reads the profile for display + role, and renders
// the sidebar nav shared by every /dashboard/* page.
// ============================================================

import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'
import DashNav from './DashNav'

export const metadata = { robots: { index: false, follow: false } }

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', session.user.id)
    .single()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)' }}>
      <DashNav fullName={profile?.full_name} role={profile?.role} email={session.user.email} />
      <main style={{ flex: 1, padding: 'clamp(20px,3vw,40px)', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
