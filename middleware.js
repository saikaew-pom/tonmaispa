import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()

  // Only guard /dashboard routes
  if (!req.nextUrl.pathname.startsWith('/dashboard')) {
    return res
  }

  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
