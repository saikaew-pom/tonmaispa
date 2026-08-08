import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import { fetchMaintenanceFlag }   from '@/lib/maintenance'

const LOCALES = ['en', 'ru', 'zh', 'th']
// Paths that stay outside the /[lang]/ tree — dashboard, API, and auth
// flows — plus anything that looks like a static file (has a dot in the
// last segment).
// /invite and /booking-request are token landings that live at the root: if
// they are not listed here they get redirected into /en/... , which does not
// exist, and every emailed link 404s.
const UNLOCALIZED_PREFIXES = [
  '/dashboard', '/api', '/login', '/forgot-password', '/reset-password', '/auth',
  '/invite', '/booking-request', '/maintenance',
]

function isLocalized(pathname) {
  const first = pathname.split('/')[1]
  return LOCALES.includes(first)
}

function langFromPath(pathname) {
  const first = pathname.split('/')[1]
  return LOCALES.includes(first) ? first : 'en'
}

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // Dashboard auth guard — MUST run before the maintenance gate so staff can
  // always reach the dashboard to turn maintenance back OFF, even while it's on.
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

  // ── Maintenance gate (public pages only) ───────────────────────────────
  // Decided HERE, in middleware, on purpose: it runs fresh on every request
  // and is never baked into an ISR cache — which is what made the previous
  // in-layout attempt serve a stale "we're closed" page (see lib/maintenance.js).
  // Dashboard/API/auth/token routes are excluded, so staff and email links
  // keep working while the public site is down.
  const isPublicPage =
    !UNLOCALIZED_PREFIXES.some(p => pathname.startsWith(p)) &&
    !pathname.split('/').pop().includes('.') // not a static-looking file

  if (isPublicPage) {
    // Preview/dev only: force the state via ?__maint=1|0 so the "on" render can
    // be verified on a preview URL WITHOUT flipping the shared production flag.
    // Compiled off in production — the override is never honored on the live site.
    const isProd = process.env.VERCEL_ENV === 'production'
    const override = req.nextUrl.searchParams.get('__maint')
    let maint
    if (!isProd && override === '1') maint = true
    else if (!isProd && override === '0') maint = false
    else maint = await fetchMaintenanceFlag()

    if (maint) {
      const url = req.nextUrl.clone()
      url.pathname = '/maintenance'
      url.search = `?lang=${langFromPath(pathname)}${!isProd && override ? `&__maint=${override}` : ''}`
      return NextResponse.rewrite(url)
    }
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
