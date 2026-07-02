'use client'

import { useEffect } from 'react'

// Next.js's App Router root layout (which owns the <html> tag) can't read
// this [lang] segment's params, so we set the lang attribute client-side
// after hydration instead. A well-known, accepted workaround.
export default function SetHtmlLang({ lang }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}
