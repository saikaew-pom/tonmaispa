import { notFound } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/get-dictionary'
import SetHtmlLang from './SetHtmlLang'

export function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }))
}

export default async function LangLayout({ children, params }) {
  const { lang } = await params
  if (!LOCALES.includes(lang)) notFound()

  return (
    <>
      <SetHtmlLang lang={lang} />
      {children}
    </>
  )
}
