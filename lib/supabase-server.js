// Cookie server client — use in dynamic server components (not ISR/static)
// NEVER use this in pages with generateStaticParams or export const revalidate
// — it calls cookies() which crashes during static generation.
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()
  return createServerComponentClient({ cookies: () => cookieStore })
}
