import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

async function getViewerRole() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  return profile?.role ?? null
}

export default async function UsersPage() {
  const role = await getViewerRole()

  if (role !== 'super_admin' && role !== 'owner') {
    return (
      <div>
        <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Users</h1>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
          <div style={{ font: '400 20px Cormorant Garamond,serif', color: '#1C1917', marginBottom: 8 }}>You don&apos;t have access to Users</div>
          <p style={{ font: '400 13px/1.6 Inter,sans-serif', color: '#6B6663' }}>Ask an owner or administrator if you need an account added.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>Users</h1>
      <UsersClient viewerRole={role} />
    </div>
  )
}
