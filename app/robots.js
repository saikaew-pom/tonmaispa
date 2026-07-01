const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tonmaispa.com'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/dashboard/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
