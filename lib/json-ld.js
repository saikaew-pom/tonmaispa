// XSS-safe JSON-LD serialiser
// Raw JSON.stringify leaves </script> in strings, which breaks the script block.
// Escape the three characters that can close or inject into HTML.

export function jsonLdScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g,  '\\u003c')
    .replace(/>/g,  '\\u003e')
    .replace(/&/g,  '\\u0026')
}

// Usage in page.jsx:
// <script
//   type="application/ld+json"
//   dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}
// />

export function spaSchema({ name, url, phone, rating, ratingCount, hours, address, sameAs = [] }) {
  return {
    '@context': 'https://schema.org',
    '@type':    'DaySpa',
    name,
    url,
    telephone:  phone,
    // Social profiles tie the entity together across the knowledge graph —
    // this is what lets search/AI engines confirm "this site, this Instagram,
    // this Facebook page are all the same business."
    ...(sameAs.length ? { sameAs } : {}),
    address: {
      '@type':           'PostalAddress',
      streetAddress:     address.street,
      addressLocality:   address.city,
      addressRegion:     address.region,
      postalCode:        address.postalCode,
      addressCountry:    'TH',
    },
    geo: {
      '@type':    'GeoCoordinates',
      latitude:   7.7826,
      longitude:  98.3164,
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:   rating,
      reviewCount:   ratingCount,
      bestRating:    '5',
      worstRating:   '1',
    },
    openingHoursSpecification: hours.map(h => ({
      '@type':     'OpeningHoursSpecification',
      dayOfWeek:   h.days,
      opens:       h.opens,
      closes:      h.closes,
    })),
    priceRange: '$$',
    currenciesAccepted: 'THB',
    paymentAccepted: 'Cash, Credit Card',
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Steam Room',  value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Sauna',       value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Cold Plunge',  value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Garden',       value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Parking',      value: true },
    ],
  }
}

// FAQPage schema from an array of { q, a } — rich-result eligible on the
// booking page's FAQ section, and a strong grounding signal for AI engines
// answering "do I need to book in advance at Ton Mai Spa?"-type queries.
export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name:    q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

// BreadcrumbList — gives search/AI engines the site hierarchy for deep
// pages (blog posts, treatment pages) instead of them guessing it from URLs.
export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map(({ name, url }, i) => ({
      '@type':    'ListItem',
      position:   i + 1,
      name,
      ...(url ? { item: url } : {}),
    })),
  }
}
