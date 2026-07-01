'use client'

// Loads GA4 only after the visitor has actually consented to analytics
// cookies. Previously this loaded unconditionally in <head> on every page
// view — that set _ga/_ga_* cookies before consent, which is exactly what
// GDPR Art. 6/7 and Thailand PDPA Section 19 don't allow for non-essential
// cookies. Injecting the script client-side, gated on stored consent, means
// no analytics cookie is set until the visitor says yes.

import { useEffect, useState } from 'react'
import { getStoredConsent, CONSENT_UPDATED_EVENT } from '@/lib/consent'

let gaLoaded = false

function loadGa4(gaId) {
  if (gaLoaded || typeof window === 'undefined') return
  gaLoaded = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', gaId, { page_path: window.location.pathname })
}

export default function GoogleAnalytics({ gaId }) {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false)

  useEffect(() => {
    const check = () => {
      const consent = getStoredConsent()
      if (consent?.analytics) setAnalyticsAllowed(true)
    }
    check()
    window.addEventListener(CONSENT_UPDATED_EVENT, check)
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, check)
  }, [])

  useEffect(() => {
    if (analyticsAllowed && gaId) loadGa4(gaId)
  }, [analyticsAllowed, gaId])

  return null
}
