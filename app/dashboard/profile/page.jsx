import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import ProfileClient from './ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin.from('profiles').select('full_name, role').eq('id', session.user.id).single()

  return (
    <div>
      <h1 style={{ font: '400 32px Cormorant Garamond,serif', color: '#1C1917', margin: '0 0 24px' }}>My Profile</h1>
      <ProfileClient
        initialFullName={profile?.full_name ?? ''}
        role={profile?.role ?? ''}
        email={session.user.email}
      />
    </div>
  )
}
