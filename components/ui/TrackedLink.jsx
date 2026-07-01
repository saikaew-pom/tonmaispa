'use client'

// Thin wrapper that fires a GA4 event on click, then behaves exactly like
// a normal link. Used inside server components that need one instrumented
// CTA without converting the whole section to 'use client'.
import Link from 'next/link'

export default function TrackedLink({ href, event, params, children, style, ...rest }) {
  const handleClick = () => {
    if (typeof window !== 'undefined' && window.gtag) window.gtag('event', event, params)
  }

  const isPageRoute = href?.startsWith('/') // internal page — must use next/link per ESLint rule

  if (isPageRoute) {
    return (
      <Link href={href} onClick={handleClick} style={style} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} onClick={handleClick} style={style} {...rest}>
      {children}
    </a>
  )
}
