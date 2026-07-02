'use client'

import { usePathname } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/get-dictionary'

// Short codes for the switcher — not translated strings, so no dictionary
// lookup needed here.
const LOCALE_CODES = { en: 'US', ru: 'RU', zh: 'CH', th: 'TH' }

// Swaps the /[lang]/ segment of the current path, keeping the visitor on
// the same page. Only used on pages that live under /[lang]/ — Nav itself
// still links out to not-yet-localized pages (spa-menu, restaurant, book).
export default function LanguageSwitcher({ lang }) {
  const pathname = usePathname()

  const hrefFor = (target) => {
    const rest = pathname.split('/').slice(2).join('/') // strip leading /<lang>
    return `/${target}${rest ? `/${rest}` : ''}`
  }

  return (
    <select
      value={lang}
      onChange={e => { window.location.href = hrefFor(e.target.value) }}
      aria-label="Language"
      style={{
        background: 'transparent', border: '1px solid rgba(28,25,23,0.2)', borderRadius: 2,
        padding: '6px 8px', font: '500 12px Inter,sans-serif', color: '#1C1917', cursor: 'pointer',
      }}
    >
      {LOCALES.map(l => (
        <option key={l} value={l}>{LOCALE_CODES[l] ?? l.toUpperCase()}</option>
      ))}
    </select>
  )
}
