import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'

const LOCALES = ['en', 'ru', 'zh', 'th']
// Paths that stay outside the /[lang]/ tree — dashboard, API, and auth
// flows — plus anything that looks like a static file (has a dot in the
// last segment).
const UNLOCALIZED_PREFIXES = [
  '/dashboard', '/api', '/login', '/forgot-password', '/reset-password', '/auth',
]

function isLocalized(pathname) {
  const first = pathname.split('/')[1]
  return LOCALES.includes(first)
}

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // Dashboard auth guard — unchanged from before.
  if (pathname.startsWith('/dashboard')) {
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return res
  }

  // The bare root is every visitor's most common entry point — serve the /en
  // content via rewrite instead of a redirect. The 307 round-trip was costing
  // ~1.5s of mobile LCP (measured); the /en canonical tag keeps search
  // engines consolidated on /en.
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/en'
    return NextResponse.rewrite(url)
  }

  // Everything else that isn't already locale-prefixed and isn't one of the
  // unlocalized flows gets redirected to the default /en locale.
  const isUnlocalizedPrefix = UNLOCALIZED_PREFIXES.some(p => pathname.startsWith(p))
  const looksLikeStaticFile = pathname.split('/').pop().includes('.')

  if (!isUnlocalizedPrefix && !looksLikeStaticFile && !isLocalized(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = `/en${pathname}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
